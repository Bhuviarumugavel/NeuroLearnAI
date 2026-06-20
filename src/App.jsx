/**
 * App.jsx — Root router + auth provider.
 */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute   from './components/ProtectedRoute';
import DashboardLayout  from './components/DashboardLayout';

import LoginPage       from './pages/LoginPage';
import RegisterPage    from './pages/RegisterPage';
import DashboardPage   from './pages/DashboardPage';
import NotesPage       from './pages/NotesPage';
import SubjectsPage    from './pages/SubjectsPage';
import QuizPage        from './pages/QuizPage';
import StudyPlansPage  from './pages/StudyPlansPage';
import RemindersPage   from './pages/RemindersPage';
import AutomationPage  from './pages/AutomationPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/login"    element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Protected routes — all wrapped in DashboardLayout */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index          element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard"   element={<DashboardPage />} />
            <Route path="notes"       element={<NotesPage />} />
            <Route path="subjects"    element={<SubjectsPage />} />
            <Route path="quiz"        element={<QuizPage />} />
            <Route path="study-plans" element={<StudyPlansPage />} />
            <Route path="reminders"   element={<RemindersPage />} />
            <Route path="automation"  element={<AutomationPage />} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
