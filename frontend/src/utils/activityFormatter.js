export const formatActivityMessage = (event, currentUser) => {
    const actorName = event.actor?._id === currentUser?._id 
        ? "You" 
        : (event.actor?.name || "Someone");
    
    switch (event.type) {
        case 'NOTE_CREATED':
            return { actor: actorName, action: `created this document` };
        case 'NOTE_RENAMED':
            return { actor: actorName, action: `renamed the document` };
        case 'COLLABORATOR_ADDED':
            const addedUser = event.metadata?.addedUser?.name || event.metadata?.addedUser?.email || event.metadata?.email || "a collaborator";
            return { actor: actorName, action: `added ${addedUser} as a collaborator` };
        case 'COLLABORATOR_REMOVED':
            const removedUser = event.metadata?.removedUser?.name || event.metadata?.removedUser?.email || event.metadata?.userId || "a collaborator";
            return { actor: actorName, action: `removed ${removedUser}` };
        case 'MANUAL_SAVE':
            return { actor: actorName, action: `saved the document` };
        case 'VERSION_RESTORED':
            return { actor: actorName, action: `restored Version ${event.metadata?.version || ''}`.trim() };
        case 'COMMENT_CREATED':
            return { actor: actorName, action: `commented on the document` };
        case 'COMMENT_DELETED':
            return { actor: actorName, action: `deleted a comment` };
        case 'REPLY_CREATED':
            return { actor: actorName, action: `replied to a comment` };
        case 'REPLY_DELETED':
            return { actor: actorName, action: `deleted a reply` };
        case 'COMMENT_RESOLVED':
            return { actor: actorName, action: `resolved a comment` };
        case 'COMMENT_REOPENED':
            return { actor: actorName, action: `reopened a comment` };
        default:
            return { actor: actorName, action: `performed an action` };
    }
}

export const formatRelativeTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) {
        return "Just now";
    }
    
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
        return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
    }
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
        return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    }
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays === 1) {
        return "Yesterday";
    }
    if (diffInDays < 7) {
        return `${diffInDays} days ago`;
    }
    
    return date.toLocaleDateString();
}
