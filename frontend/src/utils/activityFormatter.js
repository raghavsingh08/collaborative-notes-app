export const formatActivityMessage = (event, currentUser) => {
    const actorName = event.actor?._id === currentUser?._id 
        ? "You" 
        : (event.actor?.name || "Someone");
    
    switch (event.type) {
        case 'NOTE_CREATED':
            return `${actorName} created this note`;
        case 'NOTE_RENAMED':
            return `${actorName} renamed the note`;
        case 'COLLABORATOR_ADDED':
            const addedUser = event.metadata?.addedUser?.name || event.metadata?.addedUser?.email || event.metadata?.email || "a collaborator";
            return `${actorName} added ${addedUser}`;
        case 'COLLABORATOR_REMOVED':
            const removedUser = event.metadata?.removedUser?.name || event.metadata?.removedUser?.email || event.metadata?.userId || "a collaborator";
            return `${actorName} removed ${removedUser}`;
        case 'MANUAL_SAVE':
            return `${actorName} manually saved`;
        case 'VERSION_RESTORED':
            return `${actorName} restored a version`;
        case 'COMMENT_CREATED':
            return `${actorName} added a comment`;
        case 'COMMENT_DELETED':
            return `${actorName} deleted a comment`;
        case 'REPLY_CREATED':
            return `${actorName} replied to a comment`;
        case 'REPLY_DELETED':
            return `${actorName} deleted a reply`;
        case 'COMMENT_RESOLVED':
            return `${actorName} resolved a comment`;
        case 'COMMENT_REOPENED':
            return `${actorName} reopened a comment`;
        default:
            return `${actorName} performed an action`;
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
