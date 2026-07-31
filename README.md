# Collaborative Notes Platform

A production-style collaborative notes application built with the MERN stack, featuring real-time editing, anchored discussions, version history, activity tracking, and a resilient autosave architecture.

## Overview

This project focuses on building a collaborative editing platform with production-oriented engineering practices rather than a simple CRUD application.

Key goals include:

- Real-time collaborative editing
- Conflict-resilient persistence
- Version history
- Anchored discussions
- Activity tracking
- Robust keyboard accessibility
- Responsive user experience
- Production-ready architecture

---

# Features

## Real-Time Collaboration

- Multi-user collaborative editing using Yjs
- Live cursor and presence updates
- Automatic synchronization
- Conflict-free document editing
- Persistent collaborative document state

---

## Smart Autosave

- Debounced autosave
- Manual save support
- Serialized persistence queue
- Navigation-safe flushing
- Background save on tab hide
- Conflict-aware recovery
- Manual save versions
- Save status indicators

---

## Comment System

- Anchored comments
- Threaded discussions
- Replies
- Resolve / Reopen workflow
- Comment deletion
- Real-time synchronization
- Automatic orphaned anchor cleanup
- Opening-time reconciliation for missed deletion events

---

## Version History

- Manual save versions
- Version timeline
- Preview previous versions
- Restore previous versions
- Activity integration

---

## Activity Feed

Tracks important collaboration events including:

- Note creation
- Manual saves
- Title changes
- Sharing
- Version restores
- Comment creation
- Replies
- Comment deletion
- Resolve / Reopen actions

Activity updates synchronize in real time across collaborators.

---

## Sharing & Collaboration

- Share notes with users
- Owner / collaborator permissions
- Readable collaborator list
- Real-time collaboration access

---

## Command Palette

Keyboard-driven command palette with:

- Dashboard navigation
- Settings navigation
- Save note
- Open comments
- Open activity
- Open version history
- Toggle theme
- Collaborator management

Accessible and fully keyboard navigable.

---

## Keyboard Shortcuts

Currently implemented:

| Shortcut | Action |
|----------|--------|
| Ctrl/Cmd + K | Open Command Palette |
| Ctrl/Cmd + S | Manual Save |

Includes centralized shortcut handling and focus-safe execution.

---

## Responsive Design

- Desktop layout
- Tablet support
- Mobile bottom-sheet command palette
- Accessible keyboard navigation
- Responsive side panels

---

# Engineering Highlights

## Real-Time Stack

- Socket.IO
- Yjs
- TipTap Collaboration

---

## Persistence

- Optimistic persistence
- Serialized save queue
- Conflict recovery
- Debounced autosave
- Manual save pipeline

---

## UI Architecture

- Modular React components
- Context-based state
- Route protection
- Command registration system
- Editor shortcut hooks

---

## Accessibility

- Keyboard-first navigation
- Focus restoration
- Focus trapping
- Escape priority hierarchy
- Screen-reader friendly dialogs
- Accessible command palette

---

## Performance

- Debounced persistence
- Serialized network requests
- Socket invalidation instead of polling
- Duplicate request elimination
- Background synchronization
- Efficient reconciliation

---

# Tech Stack

## Frontend

- React
- Vite
- React Router
- TipTap
- Yjs
- Socket.IO Client
- Axios
- Lucide Icons
- Plain CSS

## Backend

- Node.js
- Express
- MongoDB
- Mongoose
- Socket.IO
- JWT Authentication

---

# Project Structure

```
frontend/
    components/
    pages/
    hooks/
    context/
    collaboration/
    api/

backend/
    controllers/
    models/
    routes/
    middleware/
    sockets/
    utils/
```

---

# Core Capabilities

- Real-time collaborative editing
- Conflict-aware saving
- Anchored discussions
- Version history
- Activity timeline
- Sharing
- Keyboard command palette
- Manual & automatic saving
- Responsive UI
- Authentication
- Protected routes

---

# Future Improvements

Planned enhancements include:

- Notification center
- Soft delete / Trash
- Full-text search
- User preferences
- Offline awareness
- Automated integration tests

---

# Installation

## Clone

```bash
git clone <repository-url>
cd collaborative-notes
```

## Backend

```bash
cd backend
npm install
npm run dev
```

## Frontend

```bash
cd frontend
npm install
npm run dev
```

---

# Environment Variables

Create a `.env` file inside the backend directory.

Example:

```env
PORT=5000

MONGODB_URI=your_database_uri

JWT_SECRET=your_secret

CLIENT_URL=http://localhost:5173
```

---

# Screenshots

Add screenshots or GIF demonstrations here.

Examples:

- Dashboard
- Collaborative Editor
- Version History
- Activity Feed
- Command Palette
- Comment Threads

---

# License

This project is available under the MIT License.