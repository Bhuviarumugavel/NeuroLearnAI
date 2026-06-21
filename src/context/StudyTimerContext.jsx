import { createContext, useContext, useState, useEffect, useRef } from 'react';
import api from '../utils/api';

const StudyTimerContext = createContext(null);

export function StudyTimerProvider({ children }) {
  const [activeSubjectId, setActiveSubjectId] = useState(null);
  const [activeSubjectName, setActiveSubjectName] = useState(null);
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [isActive, setIsActive] = useState(false);

  // Use a ref to always have the latest value in unmount sync
  const secondsRef = useRef(0);
  const subjectIdRef = useRef(null);

  useEffect(() => {
    secondsRef.current = secondsElapsed;
  }, [secondsElapsed]);

  useEffect(() => {
    subjectIdRef.current = activeSubjectId;
  }, [activeSubjectId]);

  // Study timer runner
  useEffect(() => {
    if (!isActive || !activeSubjectId) return;

    const timer = setInterval(() => {
      setSecondsElapsed((s) => s + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [isActive, activeSubjectId]);

  // Periodic database sync (every 20 seconds)
  useEffect(() => {
    if (!isActive || !activeSubjectId) return;

    const syncer = setInterval(() => {
      syncWithBackend();
    }, 20000);

    return () => clearInterval(syncer);
  }, [isActive, activeSubjectId]);

  // Sync on unmount/tab close
  useEffect(() => {
    return () => {
      if (subjectIdRef.current && secondsRef.current > 0) {
        // Send a beacon or synchronous-like request to ensure it persists
        const data = JSON.stringify({ seconds: secondsRef.current });
        const url = `/api/subjects/${subjectIdRef.current}/track-time`;
        // Fallback to fetch for unmount context
        api.post(url, { seconds: secondsRef.current }).catch(() => {});
      }
    };
  }, []);

  const syncWithBackend = async () => {
    const curId = subjectIdRef.current;
    const curSecs = secondsRef.current;
    if (!curId || curSecs === 0) return;

    setSecondsElapsed(0);
    try {
      await api.post(`/api/subjects/${curId}/track-time`, { seconds: curSecs });
    } catch (err) {
      console.error("Study timer sync failed:", err);
      // restore seconds on failure
      setSecondsElapsed((prev) => prev + curSecs);
    }
  };

  const startSession = (subjectId, subjectName) => {
    if (activeSubjectId === subjectId) {
      setIsActive(true); // make sure it's active
      return;
    }
    // Sync active session if switching
    if (activeSubjectId && secondsElapsed > 0) {
      syncWithBackend();
    }
    setActiveSubjectId(subjectId);
    setActiveSubjectName(subjectName);
    setSecondsElapsed(0);
    setIsActive(true);
  };

  const stopSession = async () => {
    if (!isActive) return;
    setIsActive(false);
    await syncWithBackend();
    setActiveSubjectId(null);
    setActiveSubjectName(null);
    setSecondsElapsed(0);
  };

  // Format time to MM:SS or HH:MM:SS
  const formatTime = (secs) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    const pad = (num) => String(num).padStart(2, '0');
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  };

  return (
    <StudyTimerContext.Provider
      value={{
        activeSubjectId,
        activeSubjectName,
        secondsElapsed,
        isActive,
        startSession,
        stopSession,
      }}
    >
      {children}

      {/* Floating Active Study Timer Widget */}
      {isActive && activeSubjectName && (
        <div className="timer-overlay animate-fade-in">
          <div className="timer-overlay-card">
            <div className="timer-pulse-container">
              <span className="timer-pulse-dot"></span>
              <span className="timer-pulse-ring"></span>
            </div>
            <div className="timer-overlay-info">
              <div className="timer-overlay-title">Studying {activeSubjectName}</div>
              <div className="timer-overlay-duration">{formatTime(secondsElapsed)}</div>
            </div>
            <button className="btn btn-sm btn-ghost timer-overlay-btn" onClick={stopSession} title="Pause focus session">
              ⏹️ Stop
            </button>
          </div>
        </div>
      )}
    </StudyTimerContext.Provider>
  );
}

export function useStudyTimer() {
  const ctx = useContext(StudyTimerContext);
  if (!ctx) throw new Error('useStudyTimer must be used within a StudyTimerProvider');
  return ctx;
}
