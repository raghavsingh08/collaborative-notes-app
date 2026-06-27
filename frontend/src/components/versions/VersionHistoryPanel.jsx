import React, { useEffect, useState } from 'react'
import { getNoteVersions, getNoteVersionById, restoreNoteVersion } from '../../api/notes.api'
import { History, X, Eye, RotateCcw } from 'lucide-react'

const VersionHistoryPanel = ({ noteId, refreshTrigger, onClose, isOpen }) => {
    const [versions, setVersions] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState(null)
    const [previewingVersion, setPreviewingVersion] = useState(null)
    const [previewContent, setPreviewContent] = useState(null)
    const [isPreviewLoading, setIsPreviewLoading] = useState(false)
    const [isRestoring, setIsRestoring] = useState(false)

    useEffect(() => {
        const fetchVersions = async () => {
            try {
                if (versions.length === 0) {
                    setIsLoading(true)
                }
                const res = await getNoteVersions(noteId)
                
                let extractedVersions = []
                if (Array.isArray(res.data?.data)) {
                    extractedVersions = res.data.data
                } else if (Array.isArray(res.data?.versions)) {
                    extractedVersions = res.data.versions
                } else if (Array.isArray(res.data)) {
                    extractedVersions = res.data
                }
                
                setVersions(extractedVersions)
            } catch (err) {
                console.error("Failed to fetch versions:", err)
                setError("Failed to load version history.")
            } finally {
                setIsLoading(false)
            }
        }
        fetchVersions()
    }, [noteId, refreshTrigger])

    const handlePreview = async (version) => {
        try {
            setPreviewingVersion(version)
            setIsPreviewLoading(true)
            const res = await getNoteVersionById(noteId, version._id)
            const data = res.data?.version || res.data?.data?.version || res.data
            setPreviewContent(data.content || '<p>No content</p>')
        } catch (err) {
            console.error("Failed to load preview:", err)
            alert("Failed to load preview.")
            setPreviewingVersion(null)
        } finally {
            setIsPreviewLoading(false)
        }
    }

    const handleRestore = async (versionId) => {
        if (!window.confirm("Restore this version? Your current version will be saved first.")) {
            return
        }

        try {
            setIsRestoring(true)
            await restoreNoteVersion(noteId, versionId)
            // A hard reload is the safest way to reset the local Y.Doc, socket listeners, 
            // editor instance, and collaboration state after replacing the authoritative backend Yjs snapshot.
            window.location.reload()
        } catch (err) {
            console.error("Failed to restore version:", err)
            alert("Failed to restore version.")
            setIsRestoring(false)
        }
    }

    const formatTime = (dateString) => {
        return new Date(dateString).toLocaleString()
    }

    const getAuthorName = (user) => {
        if (!user) return 'System'
        return user.name || user.username || user.email || 'Unknown User'
    }
    if (!isOpen) return null;

    return (
        <aside className="collaboration-panel version-history-sidebar desktop-panel mobile-overlay-panel panel-open" style={{ display: 'flex', flexDirection: 'column', width: '320px', backgroundColor: 'var(--surface-color)', borderLeft: '1px solid var(--border)' }}>
            <div className="sidebar-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', padding: '16px 16px 0 16px' }}>
                <div>
                    <p className="eyebrow">History</p>
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, fontSize: '16px' }}>
                        <History size={18} />
                        Versions
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

            <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px 16px' }}>
                {isLoading && <p style={{ fontSize: '13px', color: 'var(--muted)' }}>Loading versions...</p>}
                {error && <p style={{ fontSize: '13px', color: 'var(--danger, #ef4444)' }}>{error}</p>}
                
                {!isLoading && !error && versions.length === 0 && (
                    <p style={{ fontSize: '13px', color: 'var(--muted)', textAlign: 'center', marginTop: '32px' }}>
                        No versions yet. Manual saves will appear here.
                    </p>
                )}

                {!isLoading && !error && versions.map(v => (
                    <div key={v._id} style={{ 
                        padding: '12px', 
                        marginBottom: '12px', 
                        backgroundColor: 'var(--bg-color)', 
                        borderRadius: '8px',
                        border: '1px solid var(--border)' 
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                            <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-color)' }}>
                                {v.reason || 'Version'}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                                {formatTime(v.createdAt)}
                            </div>
                        </div>
                        
                        <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '12px' }}>
                            By {getAuthorName(v.createdBy)}
                        </div>

                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <button 
                                className="ghost-button" 
                                style={{ fontSize: '12px', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                                onClick={() => handlePreview(v)}
                            >
                                <Eye size={14} /> Preview
                            </button>
                            <button 
                                className="primary-button" 
                                style={{ fontSize: '12px', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                                onClick={() => handleRestore(v._id)}
                                disabled={isRestoring}
                            >
                                <RotateCcw size={14} /> Restore
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Preview Modal */}
            {previewingVersion && (
                <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, zIndex: 100, backgroundColor: 'rgba(15, 23, 42, 0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
                    <div className="modal-card" style={{ width: '100%', maxWidth: '800px', height: '100%', maxHeight: '80vh', backgroundColor: 'var(--bg-color)', padding: '24px', borderRadius: '12px', boxShadow: '0 20px 40px rgba(0,0,0,0.4)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Eye size={20} color="var(--accent)" />
                                    Preview Only - Read Only
                                </h3>
                                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--muted)' }}>
                                    {previewingVersion.reason} • {formatTime(previewingVersion.createdAt)}
                                </p>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button 
                                    className="primary-button"
                                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                                    onClick={() => handleRestore(previewingVersion._id)}
                                    disabled={isRestoring}
                                >
                                    <RotateCcw size={16} /> Restore This Version
                                </button>
                                <button className="icon-button" onClick={() => {
                                    setPreviewingVersion(null)
                                    setPreviewContent(null)
                                }}>
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        <div className="ProseMirror" style={{ flex: 1, overflowY: 'auto', padding: '16px', backgroundColor: 'var(--surface-color)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                            {isPreviewLoading ? (
                                <p style={{ color: 'var(--muted)' }}>Loading snapshot...</p>
                            ) : (
                                <div dangerouslySetInnerHTML={{ __html: previewContent }} />
                            )}
                        </div>
                    </div>
                </div>
            )}
        </aside>
    )
}

export default VersionHistoryPanel
