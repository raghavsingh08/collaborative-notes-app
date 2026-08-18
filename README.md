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

Create a `.env` file inside `backend` for local development. Do not commit it.

```env
NODE_ENV=development
PORT=8000
MONGODB_URI=your_mongodb_connection_uri
ACCESS_TOKEN_SECRET=generate_a_long_random_secret
ACCESS_TOKEN_EXPIRY=1d
CORS_ORIGIN=http://localhost:5173
```

The frontend reads public Vite variables at build time:

```env
VITE_API_URL=https://api.example.com/api/v1
VITE_SOCKET_URL=https://api.example.com
```

Never use `VITE_*` for secrets.

## Production Deployment

- Frontend: Vercel static deployment. Build from `frontend` with `npm ci && npm run build`; its existing rewrite supports React Router deep links.
- Backend: one Render Node web service rooted at `backend`, built with `npm ci`, and started with `npm start`.
- Database: MongoDB Atlas. Configure a least-privilege database user, network access, backups, and monitoring.
- Render variables: set `NODE_ENV=production`, `MONGODB_URI`, `ACCESS_TOKEN_SECRET`, `ACCESS_TOKEN_EXPIRY`, and the exact Vercel/custom frontend origins in `CORS_ORIGIN`.
- Vercel variables: set `VITE_API_URL` to the Render API URL plus `/api/v1`, and `VITE_SOCKET_URL` to the Render origin. Redeploy the frontend after changing either value.
- Configure Render's health check path as `/health`; `/ready` confirms MongoDB readiness.
- This release requires exactly one backend instance. Do not enable Render horizontal autoscaling: Socket.IO rooms, active Y.Docs, and presence are process-local. Redis is not required for V1.

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
