/**
 * CalendarPage.jsx — Interactive Calendar Page.
 * Displays exam dates, study schedule topics, and custom study alerts.
 * Supports adding custom events or rescheduling subject deadlines by clicking dates.
 */
import { useState, useEffect } from 'react';
import api from '../utils/api';
import { useData } from '../context/DataContext';

export default function CalendarPage() {
  const { refreshSubjects, refreshReminders } = useData();

  const [subjects, setSubjects] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  // June 2026 anchor (matches conversation/project timeline)
  const [currentDate, setCurrentDate] = useState(new Date(2026, 5, 21)); 

  // Modal Interactive States
  const [clickedDateStr, setClickedDateStr] = useState(null); // 'YYYY-MM-DD'
  const [showModal, setShowModal] = useState(false);
  const [modalTab, setModalTab] = useState('event'); // 'event' | 'deadline'
  
  // Form Inputs
  const [eventMessage, setEventMessage] = useState('');
  const [targetSubjectId, setTargetSubjectId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  const loadCalendarData = () => {
    setLoading(true);
    Promise.all([
      api.get('/api/subjects'),
      api.get('/api/reminders'),
      api.get('/api/study-plans')
    ]).then(([subsRes, remsRes, plansRes]) => {
      const subs = subsRes.data.subjects || [];
      setSubjects(subs);
      setReminders(remsRes.data.reminders || []);
      setPlans(plansRes.data.plans || []);
      
      if (subs.length > 0 && !targetSubjectId) {
        setTargetSubjectId(subs[0]._id || subs[0].id);
      }
    }).catch(err => {
      console.error(err);
    }).finally(() => {
      setLoading(false);
    });
  };

  useEffect(() => {
    loadCalendarData();
  }, []);

  const handleToggleTopic = async (planId, topicIdx, currentCompleted) => {
    try {
      // Optimistic update
      setPlans(prevPlans => prevPlans.map(plan => {
        if ((plan._id || plan.id) === planId) {
          const updatedTopics = [...plan.topics];
          updatedTopics[topicIdx] = {
            ...updatedTopics[topicIdx],
            completed: !currentCompleted
          };
          const completedCount = updatedTopics.filter(t => t.completed).length;
          const overall_progress = Math.round((completedCount / updatedTopics.length) * 100);
          return { ...plan, topics: updatedTopics, overall_progress };
        }
        return plan;
      }));

      await api.put(`/api/study-plans/${planId}/progress`, {
        topic_index: topicIdx,
        completed: !currentCompleted
      });
      
      loadCalendarData();
    } catch (err) {
      console.error("Failed to update topic progress", err);
    }
  };

  const handleCellClick = (dateStr) => {
    setClickedDateStr(dateStr);
    setModalError('');
    setEventMessage('');
    setShowModal(true);
  };

  const handleAddCustomEvent = async (e) => {
    e.preventDefault();
    if (!eventMessage.trim()) return;

    setSubmitting(true);
    setModalError('');
    try {
      // Create a reminder at noon on the clicked date
      const remindAt = new Date(`${clickedDateStr}T12:00:00`).toISOString();
      await api.post('/api/reminders/trigger', {
        message: eventMessage,
        remind_at: remindAt
      });
      
      // Update calendar & context
      loadCalendarData();
      await refreshReminders();
      setShowModal(false);
      setEventMessage('');
    } catch (err) {
      setModalError('Failed to save calendar event.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleChangeSubjectDeadline = async (e) => {
    e.preventDefault();
    if (!targetSubjectId) return;

    const matchedSub = subjects.find(s => (s._id || s.id) === targetSubjectId);
    if (!matchedSub) return;

    setSubmitting(true);
    setModalError('');
    try {
      await api.put(`/api/subjects/${targetSubjectId}`, {
        name: matchedSub.name,
        deadline: clickedDateStr // set new deadline YYYY-MM-DD
      });

      // Update calendar & context
      loadCalendarData();
      await refreshSubjects();
      setShowModal(false);
    } catch (err) {
      setModalError('Failed to update subject exam date.');
    } finally {
      setSubmitting(false);
    }
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Calendar math
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();
  
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const getTopicDateStr = (planCreatedAt, topicDay) => {
    const start = new Date(planCreatedAt);
    start.setDate(start.getDate() + (topicDay - 1));
    return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
  };

  // Generate date grid cells
  const cells = [];
  
  // Offset slots for previous month
  for (let i = 0; i < firstDayIndex; i++) {
    cells.push({ day: null, key: `prev-${i}`, classNames: 'calendar-day different-month' });
  }

  // Active month slots
  const today = new Date();
  for (let day = 1; day <= daysInMonth; day++) {
    const isToday = today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;
    const formattedDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    // Exam dates matching deadline
    const dayDeadlines = subjects.filter(s => s.deadline && s.deadline.startsWith(formattedDateStr));

    // Custom alerts matching remind_at
    const dayReminders = reminders.filter(r => r.remind_at && r.remind_at.startsWith(formattedDateStr));

    // Plan topics matching schedule
    const dayTopics = [];
    plans.forEach(plan => {
      plan.topics?.forEach((topic, idx) => {
        const topicDateStr = getTopicDateStr(plan.created_at, topic.day);
        if (topicDateStr === formattedDateStr) {
          dayTopics.push({
            planId: plan._id || plan.id,
            subjectName: plan.subject_name || plan.subject,
            topicIndex: idx,
            ...topic
          });
        }
      });
    });

    cells.push({
      day,
      dateStr: formattedDateStr,
      key: `active-${day}`,
      classNames: `calendar-day ${isToday ? 'today' : ''}`,
      deadlines: dayDeadlines,
      reminders: dayReminders,
      topics: dayTopics
    });
  }

  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="page-container animate-slide-up">
      {/* Header */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 className="page-title" style={{ fontSize: '1.4rem' }}>📅 Study Calendar</h1>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button className="btn btn-outline btn-sm" onClick={() => setCurrentDate(new Date(year, month - 1, 1))} style={{ padding: '4px 8px', fontSize: '0.72rem' }}>◀</button>
            <span style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: '0.88rem', minWidth: '90px', textAlign: 'center' }}>
              {monthNames[month].slice(0,3)} {year}
            </span>
            <button className="btn btn-outline btn-sm" onClick={() => setCurrentDate(new Date(year, month + 1, 1))} style={{ padding: '4px 8px', fontSize: '0.72rem' }}>▶</button>
          </div>
        </div>
        <p className="page-subtitle" style={{ fontSize: '0.78rem', margin: 0 }}>Tap any calendar day cell to modify exam deadlines or add tests.</p>
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: '360px', width: '100%', borderRadius: 'var(--radius-md)' }}></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          
          {/* Calendar Grid Container */}
          <div className="card" style={{ padding: '8px', overflow: 'hidden' }}>
            {/* Weekday headers */}
            <div className="calendar-grid" style={{ gridTemplateRows: 'auto' }}>
              {weekdays.map(d => (
                <div key={d} className="calendar-day-header" style={{ padding: '6px 4px', fontSize: '0.7rem' }}>{d}</div>
              ))}
            </div>

            {/* Monthly Day cells */}
            <div className="calendar-grid" style={{ gridAutoRows: 'minmax(72px, auto)' }}>
              {cells.map((c) => (
                <div 
                  key={c.key} 
                  className={c.classNames}
                  onClick={() => c.day && handleCellClick(c.dateStr)}
                  style={{ cursor: c.day ? 'pointer' : 'default', padding: '4px', minHeight: '80px' }}
                >
                  {c.day && (
                    <>
                      <div className="calendar-day-number" style={{ fontSize: '0.72rem' }}>{c.day}</div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px' }}>
                        {/* Exams */}
                        {c.deadlines?.map(sub => (
                          <div 
                            key={sub.id || sub._id} 
                            className="calendar-event"
                            style={{ background: sub.color || 'var(--accent-primary)', fontSize: '0.6rem', padding: '1px 3px', borderRadius: '2px' }}
                            title={`Exam: ${sub.name}`}
                          >
                            📚 {sub.name}
                          </div>
                        ))}
                        
                        {/* Study Plan Topics */}
                        {c.topics?.map((topic, idx) => {
                          const matchedSub = subjects.find(s => s.name === topic.subjectName);
                          const subColor = matchedSub?.color || 'var(--accent-primary)';
                          
                          return (
                            <div 
                              key={idx} 
                              style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '2px', 
                                fontSize: '0.58rem', 
                                background: 'rgba(255, 255, 255, 0.04)', 
                                borderLeft: `2px solid ${subColor}`,
                                padding: '1px 2px', 
                                borderRadius: '1px', 
                                color: topic.completed ? 'var(--text-muted)' : 'var(--text-primary)',
                                textDecoration: topic.completed ? 'line-through' : 'none'
                              }} 
                              title={`Topic: ${topic.name}`}
                            >
                              <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{topic.name}</span>
                            </div>
                          );
                        })}
                        
                        {/* Custom Reminders / Tests */}
                        {c.reminders?.map((rem, idx) => (
                          <div 
                            key={idx} 
                            className="calendar-event"
                            style={{ background: 'rgba(245, 158, 11, 0.75)', border: '1px solid var(--accent-orange)', fontSize: '0.6rem', padding: '1px 3px', borderRadius: '2px' }}
                            title={`Event: ${rem.message}`}
                          >
                            🔔 {rem.message}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: 'var(--accent-primary)', display: 'inline-block' }}></span>
              Exam/Deadline
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: 'rgba(245, 158, 11, 0.7)', display: 'inline-block' }}></span>
              Custom Alerts
            </div>
          </div>

        </div>
      )}

      {/* Interactive Modal Form (Day Clicking) */}
      {showModal && (
        <div className="overlay" style={{ zIndex: 1100 }}>
          <div className="modal animate-slide-up" style={{ padding: '20px', maxWidth: '380px' }}>
            <div className="modal-header" style={{ marginBottom: '14px' }}>
              <h3 style={{ fontSize: '0.98rem' }}>📅 Manage: {clickedDateStr}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)} style={{ fontSize: '0.9rem', padding: '4px' }}>✕</button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '6px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px', marginBottom: '16px' }}>
              <button 
                type="button"
                className={`btn btn-sm ${modalTab === 'event' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setModalTab('event')}
                style={{ flex: 1, fontSize: '0.75rem', padding: '6px' }}
              >
                🔔 Add Event/Test
              </button>
              <button 
                type="button"
                className={`btn btn-sm ${modalTab === 'deadline' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setModalTab('deadline')}
                style={{ flex: 1, fontSize: '0.75rem', padding: '6px' }}
              >
                ⚙️ Set Exam Date
              </button>
            </div>

            {modalError && <div className="auth-error text-xs mb-16">{modalError}</div>}

            {/* Tab 1: Custom Event Creation */}
            {modalTab === 'event' && (
              <form onSubmit={handleAddCustomEvent} className="flex-col" style={{ gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="calendar-event-title" style={{ fontSize: '0.72rem' }}>Event / Test Title</label>
                  <input 
                    id="calendar-event-title"
                    className="form-input" 
                    placeholder="e.g. 2 lessons test" 
                    value={eventMessage}
                    onChange={(e) => setEventMessage(e.target.value)}
                    style={{ fontSize: '0.8rem', height: '36px', padding: '8px 12px' }}
                    required
                  />
                </div>
                <button 
                  type="submit" 
                  className={`btn btn-primary btn-full ${submitting ? 'btn-loading' : ''}`}
                  disabled={submitting || !eventMessage.trim()}
                  style={{ fontSize: '0.8rem', padding: '10px' }}
                >
                  {submitting ? 'Scheduling...' : 'Save Event'}
                </button>
              </form>
            )}

            {/* Tab 2: Change Subject Exam Deadline */}
            {modalTab === 'deadline' && (
              <form onSubmit={handleChangeSubjectDeadline} className="flex-col" style={{ gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="calendar-subject-select" style={{ fontSize: '0.72rem' }}>Select Subject</label>
                  {subjects.length === 0 ? (
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No subjects configured.</p>
                  ) : (
                    <select 
                      id="calendar-subject-select"
                      className="form-input"
                      value={targetSubjectId}
                      onChange={(e) => setTargetSubjectId(e.target.value)}
                      style={{ background: 'var(--bg-input)', fontSize: '0.8rem', height: '36px', padding: '8px 12px' }}
                    >
                      {subjects.map(s => (
                        <option key={s._id || s.id} value={s._id || s.id}>{s.name}</option>
                      ))}
                    </select>
                  )}
                </div>
                <button 
                  type="submit" 
                  className={`btn btn-primary btn-full ${submitting ? 'btn-loading' : ''}`}
                  disabled={submitting || subjects.length === 0}
                  style={{ fontSize: '0.8rem', padding: '10px' }}
                >
                  {submitting ? 'Rescheduling...' : 'Set Deadline'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
