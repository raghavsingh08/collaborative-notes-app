import React, { useEffect, useState } from 'react'
import { getNoteActivity } from '../../api/notes.api'
import { Activity, X, User } from 'lucide-react'
import { formatActivityMessage, formatRelativeTime } from '../../utils/activityFormatter'

const ActivitySidebar = ({ noteId, currentUser, refreshTrigger, onClose }) => {
    const [events, setEvents] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        const fetchActivity = async () => {
            try {
                if (events.length === 0) {
                    setIsLoading(true)
                }
                const res = await getNoteActivity(noteId)
                
                let extractedEvents = []
                if (Array.isArray(res.data?.data)) {
                    extractedEvents = res.data.data
                } else if (Array.isArray(res.data?.events)) {
                    extractedEvents = res.data.events
                } else if (Array.isArray(res.data)) {
                    extractedEvents = res.data
                }
                
                setEvents(extractedEvents)
            } catch (err) {
                console.error("Failed to fetch activity:", err)
                setError("Failed to load activity timeline.")
            } finally {
                setIsLoading(false)
            }
        }
        fetchActivity()
    }, [noteId, refreshTrigger])

    return (
        <aside className="collaboration-panel activity-sidebar" style={{ display: 'flex', flexDirection: 'column', width: '320px', backgroundColor: 'var(--surface-color)', borderLeft: '1px solid var(--border)', zIndex: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', padding: '16px 16px 0 16px' }}>
                <div>
                    <p className="eyebrow">Timeline</p>
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, fontSize: '16px' }}>
                        <Activity size={18} />
                        Activity
                    </h2>
                </div>
                <button 
                    className="icon-button" 
                    onClick={onClose}
                    title="Close"
                >
                    <X size={18} />
                </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px 16px' }}>
                {isLoading && <p style={{ fontSize: '13px', color: 'var(--muted)' }}>Loading activity...</p>}
                {error && <p style={{ fontSize: '13px', color: 'var(--danger, #ef4444)' }}>{error}</p>}
                
                {!isLoading && !error && events.length === 0 && (
                    <p style={{ fontSize: '13px', color: 'var(--muted)', textAlign: 'center', marginTop: '32px' }}>
                        No activity yet.
                    </p>
                )}

                {!isLoading && !error && events.map((event) => (
                    <div key={event._id} style={{ 
                        display: 'flex', 
                        gap: '12px', 
                        marginBottom: '16px',
                        alignItems: 'flex-start'
                    }}>
                        <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            backgroundColor: 'var(--border)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden',
                            flexShrink: 0
                        }}>
                            {event.actor?.avatar ? (
                                <img src={event.actor.avatar} alt={event.actor.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                <User size={16} color="var(--muted)" />
                            )}
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ fontSize: '13px', color: 'var(--text-color)', lineHeight: 1.4 }}>
                                {formatActivityMessage(event, currentUser)}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                                {formatRelativeTime(event.createdAt)}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </aside>
    )
}

export default ActivitySidebar
