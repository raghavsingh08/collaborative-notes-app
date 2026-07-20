import React, { useCallback, useEffect, useRef, useState } from 'react'
import { getNoteActivity } from '../../api/notes.api'
import socket from '../../api/socket'
import { Activity, X, User } from 'lucide-react'
import { formatActivityMessage, formatRelativeTime } from '../../utils/activityFormatter'

const groupActivityEvents = (events) => {
    if (!events || events.length === 0) return [];
    
    const grouped = [];
    let currentGroup = null;
    
    for (let i = 0; i < events.length; i++) {
        const event = events[i];
        
        if (event.type === 'MANUAL_SAVE') {
            if (currentGroup && currentGroup.type === 'MANUAL_SAVE' && currentGroup.actor?._id === event.actor?._id) {
                const timeDiff = Math.abs(new Date(currentGroup.createdAt) - new Date(event.createdAt));
                if (timeDiff <= 60 * 60 * 1000) {
                    currentGroup.count = (currentGroup.count || 1) + 1;
                    continue;
                }
            }
            
            currentGroup = { ...event, count: 1 };
            grouped.push(currentGroup);
        } else {
            currentGroup = null;
            grouped.push(event);
        }
    }
    
    return grouped;
};

const ActivitySidebar = ({ noteId, currentUser, onClose, isOpen }) => {
    const [events, setEvents] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState(null)
    const eventsRef = useRef(events)
    const activityListRef = useRef(null)
    const activeActivityFetchRef = useRef(null)
    const activeActivityNoteIdRef = useRef(null)
    const pendingActivityRefreshRef = useRef(null)
    const isMountedRef = useRef(false)
    const noteIdRef = useRef(noteId)

    eventsRef.current = events
    noteIdRef.current = noteId

    const fetchActivity = useCallback((background = false) => {
        if (!noteId) {
            return Promise.resolve()
        }

        if (
            activeActivityFetchRef.current &&
            !background &&
            !pendingActivityRefreshRef.current &&
            String(activeActivityNoteIdRef.current) === String(noteId)
        ) {
            return activeActivityFetchRef.current
        }

        const queuedRefresh = pendingActivityRefreshRef.current

        if (queuedRefresh && String(queuedRefresh.noteId) === String(noteId)) {
            queuedRefresh.background = queuedRefresh.background && background
        } else {
            pendingActivityRefreshRef.current = { noteId, background }
        }

        if (activeActivityFetchRef.current) {
            return activeActivityFetchRef.current
        }

        const refreshWorker = (async () => {
            while (pendingActivityRefreshRef.current) {
                const refresh = pendingActivityRefreshRef.current
                pendingActivityRefreshRef.current = null
                activeActivityNoteIdRef.current = refresh.noteId

                const scrollContainer = activityListRef.current
                const previousScrollTop = refresh.background ? scrollContainer?.scrollTop : null
                const canApplyResult = () => (
                    isMountedRef.current &&
                    String(noteIdRef.current) === String(refresh.noteId)
                )

                try {
                    if (canApplyResult()) {
                        if (!refresh.background && eventsRef.current.length === 0) {
                            setIsLoading(true)
                        }
                        setError(null)
                    }

                    const res = await getNoteActivity(refresh.noteId)

                    if (!canApplyResult()) {
                        continue
                    }

                    let extractedEvents = []
                    if (Array.isArray(res.data?.data)) {
                        extractedEvents = res.data.data
                    } else if (Array.isArray(res.data?.events)) {
                        extractedEvents = res.data.events
                    } else if (Array.isArray(res.data)) {
                        extractedEvents = res.data
                    }

                    setEvents(extractedEvents)

                    if (refresh.background && scrollContainer && previousScrollTop !== null) {
                        requestAnimationFrame(() => {
                            if (canApplyResult()) {
                                scrollContainer.scrollTop = previousScrollTop
                            }
                        })
                    }
                } catch (err) {
                    if (canApplyResult()) {
                        console.error("Failed to fetch activity:", err)
                        setError("Failed to load activity timeline.")
                    }
                } finally {
                    if (canApplyResult()) {
                        setIsLoading(false)
                    }
                }
            }
        })()

        activeActivityFetchRef.current = refreshWorker
        refreshWorker.finally(() => {
            if (activeActivityFetchRef.current === refreshWorker) {
                activeActivityFetchRef.current = null
                activeActivityNoteIdRef.current = null
            }
        })

        return refreshWorker
    }, [noteId])

    useEffect(() => {
        isMountedRef.current = true

        return () => {
            isMountedRef.current = false
        }
    }, [])

    useEffect(() => {
        if (!noteId) return undefined

        const handleActivityUpdated = (payload) => {
            if (String(payload?.noteId) !== String(noteId)) return

            fetchActivity(true)
        }

        socket.on('activity:updated', handleActivityUpdated)

        return () => {
            socket.off('activity:updated', handleActivityUpdated)
        }
    }, [noteId, fetchActivity])

    useEffect(() => {
        fetchActivity()
    }, [fetchActivity])

    const groupedEvents = groupActivityEvents(events);
    if (!isOpen) return null;

    return (
        <aside className="collaboration-panel activity-sidebar desktop-panel mobile-overlay-panel panel-open" style={{ display: 'flex', flexDirection: 'column', width: '320px', backgroundColor: 'var(--surface-color)', borderLeft: '1px solid var(--border)' }}>
            <div className="sidebar-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', padding: '16px 16px 0 16px' }}>
                <div>
                    <p className="eyebrow">Timeline</p>
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, fontSize: '16px' }}>
                        <Activity size={18} />
                        Activity
                    </h2>
                </div>
                <button 
                    className="icon-button mobile-panel-close-btn" 
                    onClick={onClose}
                    title="Close"
                >
                    <X size={18} />
                </button>
            </div>

            <div ref={activityListRef} style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px 16px' }}>
                {isLoading && <p style={{ fontSize: '13px', color: 'var(--muted)' }}>Loading activity...</p>}
                {error && <p style={{ fontSize: '13px', color: 'var(--danger, #ef4444)' }}>{error}</p>}
                
                {!isLoading && !error && groupedEvents.length === 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '40px 0', color: 'var(--muted-strong)' }}>
                        <Activity size={28} style={{ opacity: 0.3, marginBottom: '16px', color: 'var(--text)' }} />
                        <p style={{ fontSize: '14px', fontWeight: '600', margin: '0 0 6px 0', color: 'var(--text)' }}>No activity yet</p>
                        <p style={{ fontSize: '13px', margin: 0, color: 'var(--muted)', lineHeight: '1.4' }}>Edits, comments, sharing events, and version history will appear here.</p>
                    </div>
                )}

                {!isLoading && groupedEvents.map((event, index) => (
                    <div key={event._id || index} style={{ 
                        display: 'flex', 
                        gap: '12px', 
                        alignItems: 'stretch'
                    }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <div style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                backgroundColor: 'var(--surface-color)',
                                border: '1px solid var(--border)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                overflow: 'hidden',
                                flexShrink: 0
                            }}>
                                {event.actor?.avatar ? (
                                    <img src={event.actor.avatar} alt={event.actor.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    <User size={16} color="var(--muted-strong)" />
                                )}
                            </div>
                            {index < groupedEvents.length - 1 && (
                                <div style={{
                                    width: '1px',
                                    flex: 1,
                                    backgroundColor: 'var(--border)',
                                    marginTop: '8px',
                                    marginBottom: '8px'
                                }} />
                            )}
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingBottom: index === groupedEvents.length - 1 ? '16px' : '24px', paddingTop: '4px' }}>
                            <div style={{ fontSize: '13px', lineHeight: 1.4 }}>
                                {(() => {
                                    const { actor, action } = formatActivityMessage(event, currentUser);
                                    return (
                                        <span>
                                            <span style={{ fontWeight: 600, color: 'var(--text)' }}>{actor}</span>{' '}
                                            <span style={{ color: 'var(--muted-strong)' }}>
                                                {action}
                                                {event.count > 1 ? ` (${event.count} times)` : ''}
                                            </span>
                                        </span>
                                    );
                                })()}
                            </div>
                            <div className="activity-timestamp-wrapper" style={{ position: 'relative', display: 'inline-block', width: 'fit-content' }}>
                                <span className="activity-timestamp" style={{ fontSize: '12px', color: 'var(--muted)', cursor: 'default' }}>
                                    {formatRelativeTime(event.createdAt)}
                                </span>
                                <div className="activity-tooltip">
                                    {new Date(event.createdAt).toLocaleString(undefined, { 
                                        year: 'numeric', month: 'long', day: 'numeric', 
                                        hour: 'numeric', minute: 'numeric' 
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </aside>
    )
}

export default ActivitySidebar
