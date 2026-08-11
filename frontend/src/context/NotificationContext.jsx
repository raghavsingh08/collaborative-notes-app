import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import {
    getNotifications,
    markAllNotificationsRead,
    markNotificationRead
} from "../api/notifications.api"
import socket from "../api/socket"
import { useCommandPalette } from "../hooks/useCommandPalette"
import NotificationPanel from "../components/notifications/NotificationPanel"

const NotificationContext = createContext(null)
const DEFAULT_NOTIFICATION_LIMIT = 30

const getErrorMessage = (error, fallback) => {
    return error?.response?.data?.message || error?.message || fallback
}

const getNotificationData = (response) => {
    const data = response?.data?.data

    if (!data || !Array.isArray(data.items)) {
        throw new Error("Invalid notifications response")
    }

    return {
        items: deduplicateNotifications(data.items),
        nextCursor: typeof data.nextCursor === "string" && data.nextCursor ? data.nextCursor : null,
        unreadCount: Number.isInteger(data.unreadCount) && data.unreadCount >= 0 ? data.unreadCount : 0
    }
}

const deduplicateNotifications = (items) => {
    const seen = new Set()

    return items.filter((item) => {
        const id = item?._id ? String(item._id) : ""

        if (!id || seen.has(id)) return false
        seen.add(id)
        return true
    })
}

export const NotificationProvider = ({ children }) => {
    const navigate = useNavigate()
    const location = useLocation()
    const { isOpen: isCommandPaletteOpen } = useCommandPalette()
    const [notifications, setNotifications] = useState([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [nextCursor, setNextCursor] = useState(null)
    const [isInitialLoading, setIsInitialLoading] = useState(true)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [isLoadingMore, setIsLoadingMore] = useState(false)
    const [isMarkingAll, setIsMarkingAll] = useState(false)
    const [pendingReadIds, setPendingReadIds] = useState(new Set())
    const [error, setError] = useState("")
    const [isPanelOpen, setIsPanelOpen] = useState(false)
    const isMountedRef = useRef(false)
    const providerGenerationRef = useRef(0)
    const notificationsRef = useRef([])
    const nextCursorRef = useRef(null)
    const activeRefreshRef = useRef(null)
    const activePaginationRef = useRef(null)
    const pendingRefreshRef = useRef(null)
    const pendingReadIdsRef = useRef(new Set())
    const markAllInFlightRef = useRef(false)
    const runRefreshWorkerRef = useRef(null)

    const applyNotificationPage = useCallback((data) => {
        notificationsRef.current = data.items
        nextCursorRef.current = data.nextCursor
        setNotifications(data.items)
        setNextCursor(data.nextCursor)
        setUnreadCount(data.unreadCount)
    }, [])

    const runRefreshWorker = useCallback(() => {
        if (activeRefreshRef.current || activePaginationRef.current) {
            return activeRefreshRef.current || activePaginationRef.current || Promise.resolve()
        }

        const worker = (async () => {
            while (pendingRefreshRef.current) {
                const request = pendingRefreshRef.current
                pendingRefreshRef.current = null
                const canApplyResult = () => (
                    isMountedRef.current &&
                    providerGenerationRef.current === request.generation
                )

                if (canApplyResult()) {
                    if (!request.background && notificationsRef.current.length === 0) {
                        setIsInitialLoading(true)
                    }
                    setIsRefreshing(request.background)
                }

                try {
                    const response = await getNotifications({
                        limit: DEFAULT_NOTIFICATION_LIMIT
                    })
                    const data = getNotificationData(response)

                    if (!canApplyResult()) continue

                    applyNotificationPage(data)
                    setError("")
                } catch (refreshError) {
                    if (canApplyResult()) {
                        setError(getErrorMessage(refreshError, "Unable to load notifications."))
                    }
                } finally {
                    if (canApplyResult() && !request.background) {
                        setIsInitialLoading(false)
                    }
                }
            }
        })()

        activeRefreshRef.current = worker
        worker.finally(() => {
            if (activeRefreshRef.current !== worker) return

            activeRefreshRef.current = null

            if (isMountedRef.current) {
                setIsRefreshing(false)
            }

            if (pendingRefreshRef.current && !activePaginationRef.current) {
                runRefreshWorkerRef.current?.()
            }
        })

        return worker
    }, [applyNotificationPage])

    runRefreshWorkerRef.current = runRefreshWorker

    const refreshNotifications = useCallback((background = true) => {
        const generation = providerGenerationRef.current
        const pendingRefresh = pendingRefreshRef.current

        if (pendingRefresh && pendingRefresh.generation === generation) {
            pendingRefresh.background = pendingRefresh.background && background
        } else {
            pendingRefreshRef.current = { background, generation }
        }

        if (activeRefreshRef.current || activePaginationRef.current) {
            return activeRefreshRef.current || activePaginationRef.current || Promise.resolve()
        }

        return runRefreshWorkerRef.current?.() || Promise.resolve()
    }, [])

    const loadMore = useCallback(async () => {
        const cursor = nextCursorRef.current

        if (!cursor || activePaginationRef.current || activeRefreshRef.current) {
            return false
        }

        const generation = providerGenerationRef.current
        const worker = (async () => {
            if (isMountedRef.current) {
                setIsLoadingMore(true)
            }

            try {
                const response = await getNotifications({
                    limit: DEFAULT_NOTIFICATION_LIMIT,
                    cursor
                })
                const data = getNotificationData(response)

                if (
                    !isMountedRef.current ||
                    generation !== providerGenerationRef.current ||
                    pendingRefreshRef.current
                ) {
                    return false
                }

                const currentItems = notificationsRef.current
                const mergedItems = deduplicateNotifications([...currentItems, ...data.items])
                notificationsRef.current = mergedItems
                nextCursorRef.current = data.nextCursor
                setNotifications(mergedItems)
                setNextCursor(data.nextCursor)
                setUnreadCount(data.unreadCount)
                setError("")
                return true
            } catch (loadError) {
                if (isMountedRef.current && generation === providerGenerationRef.current) {
                    setError(getErrorMessage(loadError, "Unable to load older notifications."))
                }
                return false
            } finally {
                if (isMountedRef.current && generation === providerGenerationRef.current) {
                    setIsLoadingMore(false)
                }
            }
        })()

        activePaginationRef.current = worker
        worker.finally(() => {
            if (activePaginationRef.current === worker) {
                activePaginationRef.current = null
            }

            if (pendingRefreshRef.current) {
                runRefreshWorkerRef.current?.()
            }
        })

        return worker
    }, [])

    const markAsRead = useCallback(async (notificationId) => {
        const id = notificationId ? String(notificationId) : ""

        if (!id || pendingReadIdsRef.current.has(id)) {
            return false
        }

        pendingReadIdsRef.current.add(id)
        setPendingReadIds(new Set(pendingReadIdsRef.current))

        try {
            await markNotificationRead(id)
            refreshNotifications(true)
            return true
        } catch (readError) {
            if (isMountedRef.current) {
                setError(getErrorMessage(readError, "Unable to mark this notification as read."))
            }
            return false
        } finally {
            pendingReadIdsRef.current.delete(id)
            if (isMountedRef.current) {
                setPendingReadIds(new Set(pendingReadIdsRef.current))
            }
        }
    }, [refreshNotifications])

    const markAllAsRead = useCallback(async () => {
        if (markAllInFlightRef.current) {
            return false
        }

        markAllInFlightRef.current = true
        setIsMarkingAll(true)

        try {
            await markAllNotificationsRead()
            refreshNotifications(true)
            return true
        } catch (markAllError) {
            if (isMountedRef.current) {
                setError(getErrorMessage(markAllError, "Unable to mark notifications as read."))
            }
            return false
        } finally {
            markAllInFlightRef.current = false
            if (isMountedRef.current) {
                setIsMarkingAll(false)
            }
        }
    }, [refreshNotifications])

    const closePanel = useCallback(() => {
        setIsPanelOpen(false)
    }, [])

    const openPanel = useCallback(() => {
        setIsPanelOpen(true)
        refreshNotifications(true)
    }, [refreshNotifications])

    const togglePanel = useCallback(() => {
        if (isPanelOpen) {
            closePanel()
            return
        }

        openPanel()
    }, [closePanel, isPanelOpen, openPanel])

    const openNotification = useCallback(async (notification) => {
        if (!notification?._id || !notification?.noteId) {
            return false
        }

        const didMarkRead = await markAsRead(notification._id)

        if (!didMarkRead) {
            return false
        }

        closePanel()

        const noteId = String(notification.noteId)
        const isCommentNotification = [
            "COMMENT_REPLY",
            "COMMENT_RESOLVED",
            "COMMENT_REOPENED"
        ].includes(notification.type)

        if (isCommentNotification && notification.threadId) {
            const params = new URLSearchParams({
                panel: "comments",
                thread: String(notification.threadId)
            })
            navigate(`/notes/${noteId}?${params.toString()}`)
        } else {
            navigate(`/notes/${noteId}`)
        }

        return true
    }, [closePanel, markAsRead, navigate])

    useEffect(() => {
        isMountedRef.current = true
        providerGenerationRef.current += 1
        refreshNotifications(false)

        return () => {
            isMountedRef.current = false
            providerGenerationRef.current += 1
        }
    }, [refreshNotifications])

    useEffect(() => {
        const handleNotificationsUpdated = (payload) => {
            if (payload !== undefined && (payload === null || typeof payload !== "object" || Array.isArray(payload))) {
                return
            }

            refreshNotifications(true)
        }

        const handleConnect = () => {
            refreshNotifications(true)
        }

        socket.on("notifications:updated", handleNotificationsUpdated)
        socket.on("connect", handleConnect)

        if (!socket.connected) {
            socket.connect()
        }

        return () => {
            socket.off("notifications:updated", handleNotificationsUpdated)
            socket.off("connect", handleConnect)
        }
    }, [refreshNotifications])

    useEffect(() => {
        if (isCommandPaletteOpen) {
            closePanel()
        }
    }, [closePanel, isCommandPaletteOpen])

    useEffect(() => {
        closePanel()
    }, [closePanel, location.pathname, location.search])

    const value = useMemo(() => ({
        closePanel,
        error,
        isInitialLoading,
        isLoadingMore,
        isMarkingAll,
        isPanelOpen,
        isRefreshing,
        loadMore,
        markAllAsRead,
        markAsRead,
        nextCursor,
        notifications,
        openNotification,
        openPanel,
        pendingReadIds,
        refreshNotifications,
        togglePanel,
        unreadCount
    }), [
        closePanel,
        error,
        isInitialLoading,
        isLoadingMore,
        isMarkingAll,
        isPanelOpen,
        isRefreshing,
        loadMore,
        markAllAsRead,
        markAsRead,
        nextCursor,
        notifications,
        openNotification,
        openPanel,
        pendingReadIds,
        refreshNotifications,
        togglePanel,
        unreadCount
    ])

    return (
        <NotificationContext.Provider value={value}>
            {children}
            <NotificationPanel
                error={error}
                isLoading={isInitialLoading}
                isLoadingMore={isLoadingMore}
                isMarkingAll={isMarkingAll}
                isOpen={isPanelOpen}
                nextCursor={nextCursor}
                notifications={notifications}
                onClose={closePanel}
                onLoadMore={loadMore}
                onMarkAllAsRead={markAllAsRead}
                onNotificationClick={openNotification}
                onRetry={() => refreshNotifications(false)}
                pendingReadIds={pendingReadIds}
            />
        </NotificationContext.Provider>
    )
}

export const useNotifications = () => {
    const context = useContext(NotificationContext)

    if (!context) {
        throw new Error("useNotifications must be used within a NotificationProvider")
    }

    return context
}