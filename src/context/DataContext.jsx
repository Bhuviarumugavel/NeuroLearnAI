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
  const [plans, setPlans] = useState([]);
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

  const refreshPlans = useCallback(async () => {
    try {
      const res = await api.get('/api/study-plans');
      setPlans(res.data.plans || []);
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
        refreshPlans(),
        refreshSummary()
      ]);
    } catch (e) {
      console.error('Error refreshing global data:', e);
    } finally {
      setLoading(false);
    }
  }, [user, refreshSubjects, refreshNotes, refreshReminders, refreshQuizzes, refreshSummary]);

  const [notifiedReminderIds, setNotifiedReminderIds] = useState(new Set());

  // Request browser Notification permission on login/mount
  useEffect(() => {
    if (user && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [user]);

  // Real-time study alert checker polling loop
  useEffect(() => {
    if (!user || reminders.length === 0) return;

    const interval = setInterval(() => {
      const now = new Date();
      reminders.forEach((r) => {
        const id = r._id || r.id;
        const remindTime = new Date(r.remind_at);
        
        // Trigger if reminder time has arrived and hasn't been fired in this session
        if (remindTime <= now && !notifiedReminderIds.has(id)) {
          // Avoid triggering extremely old alerts (older than 15 mins)
          const fifteenMinsAgo = new Date(now.getTime() - 15 * 60 * 1000);
          if (remindTime >= fifteenMinsAgo) {
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification("📚 NeurolearnAI Study Alert!", {
                body: r.message,
                icon: "/favicon.ico"
              });
            } else {
              // Toast fallback
              alert(`🔔 Study Alert: ${r.message}`);
            }
          }
          
          setNotifiedReminderIds(prev => {
            const next = new Set(prev);
            next.add(id);
            return next;
          });
        }
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [user, reminders, notifiedReminderIds]);

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
    plans,
    progressSummary,
    loading,
    refreshSubjects,
    refreshNotes,
    refreshReminders,
    refreshQuizzes,
    refreshPlans,
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
