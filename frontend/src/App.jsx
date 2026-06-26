import { Route, Routes } from "react-router-dom"
import ProtectedRoute from "./routes/ProtectedRoute"
import PublicRoute from "./routes/PublicRoute"
import HomePage from "./pages/HomePage"
import LoginPage from "./pages/LoginPage"
import RegisterPage from "./pages/RegisterPage"
import DashboardPage from "./pages/DashboardPage"
import NoteEditorPage from "./pages/NoteEditorPage"
import SettingsPage from "./pages/SettingsPage"
import NotFoundPage from "./pages/NotFoundPage"
import NoteEditorV2Page from "./pages/NoteEditorV2Page"

const App = () => {
    return (
        <Routes>
            <Route path="/" element={<HomePage />} />

            <Route element={<PublicRoute />}>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
            </Route>

            <Route element={<ProtectedRoute />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/notes/:noteId" element={<NoteEditorPage />} />
                <Route path="/notes/:noteId/v2" element={<NoteEditorV2Page />} />
                <Route path="/settings" element={<SettingsPage />} />
            </Route>

            <Route path="*" element={<NotFoundPage />} />
        </Routes>
    )
}

export default App
