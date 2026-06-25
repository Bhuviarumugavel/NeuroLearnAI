import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import { useAuth } from './AuthContext';

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState([]);
  const [notes, setNotes] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [progressSummary, setProgressSummary] = useState(null);
  const [loading, setLoading] = useState(false);

  const refreshSubjects = useCallback(async () => {
    try {
      const res = await api.get('/api/subjects');
      setSubjects(res.data.subjects || []);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const refreshNotes = useCallback(async () => {
    try {
      const res = await api.get('/api/notes');
      setNotes(res.data.notes || []);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const refreshReminders = useCallback(async () => {
    try {
      const res = await api.get('/api/reminders');
      setReminders(res.data.reminders || []);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const refreshQuizzes = useCallback(async () => {
    try {
      const res = await api.get('/api/quiz/history');
      setQuizzes(res.data.quizzes || []);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const refreshSummary = useCallback(async () => {
    try {
      const res = await api.get('/api/dashboard/summary');
      setProgressSummary(res.data || null);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      await Promise.all([
        refreshSubjects(),
        refreshNotes(),
        refreshReminders(),
        refreshQuizzes(),
        refreshSummary()
      ]);
    } catch (e) {
      console.error('Error refreshing global data:', e);
    } finally {
      setLoading(false);
    }
  }, [user, refreshSubjects, refreshNotes, refreshReminders, refreshQuizzes, refreshSummary]);

  // Automatically refresh all data when the user logs in
  useEffect(() => {
    if (user) {
      refreshAll();
    } else {
      setSubjects([]);
      setNotes([]);
      setReminders([]);
      setQuizzes([]);
      setProgressSummary(null);
    }
  }, [user, refreshAll]);

  const value = {
    subjects,
    notes,
    reminders,
    quizzes,
    progressSummary,
    loading,
    refreshSubjects,
    refreshNotes,
    refreshReminders,
    refreshQuizzes,
    refreshSummary,
    refreshAll,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside DataProvider');
  return ctx;
}
