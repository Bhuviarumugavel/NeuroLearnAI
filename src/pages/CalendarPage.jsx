/**
 * CalendarPage.jsx — Interactive Calendar Page.
 * Displays exam dates, study schedule topics, and custom study alerts.
 * Restructured to:
 * 1. Support showing the daily topic, and the relevant study notes & quizzes based on the topic of the day.
 * 2. Optimize state management using global DataContext.
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { useData } from '../context/DataContext';

export default function CalendarPage() {
  const { 
    subjects, 
    reminders, 
    plans, 
    notes, 
    quizzes, 
    refreshAll, 
    refreshReminders, 
    refreshSubjects 
  } = useData();

  const [loadingLocal, setLoadingLocal] = useState(false);

  // June 2026 anchor (matches conversation/project timeline)
  const [currentDate, setCurrentDate] = useState(new Date(2026, 5, 21)); 
  const [selectedDateStr, setSelectedDateStr] = useState('2026-06-21'); // Default selected day

  // Modal Interactive States (for actions)
  const [clickedDateStr, setClickedDateStr] = useState(null); // 'YYYY-MM-DD'
  const [showModal, setShowModal] = useState(false);
  const [modalTab, setModalTab] = useState('event'); // 'event' | 'deadline'
  
  // Form Inputs
  const [eventMessage, setEventMessage] = useState('');
  const [targetSubjectId, setTargetSubjectId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  const [expandedNotes, setExpandedNotes] = useState({});

  useEffect(() => {
    setLoadingLocal(true);
    refreshAll().finally(() => {
      setLoadingLocal(false);
    });
  }, []);

  // Pre-populate targetSubjectId when subjects load
  useEffect(() => {
    if (subjects.length > 0 && !targetSubjectId) {
      setTargetSubjectId(subjects[0]._id || subjects[0].id);
    }
  }, [subjects, targetSubjectId]);

  const handleToggleTopic = async (planId, topicIdx, currentCompleted) => {
    try {
      await api.put(`/api/study-plans/${planId}/progress`, {
        topic_index: topicIdx,
        completed: !currentCompleted
      });
      refreshAll();
    } catch (err) {
      console.error("Failed to update topic progress", err);
    }
  };

  const handleCellClick = (dateStr) => {
    setSelectedDateStr(dateStr);
  };

  const openActionModal = (tab, dateStr) => {
    setClickedDateStr(dateStr);
    setModalTab(tab);
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
      const remindAt = new Date(`${clickedDateStr}T12:00:00`).toISOString();
      await api.post('/api/reminders/trigger', {
        message: eventMessage,
        remind_at: remindAt
      });
      
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
        deadline: clickedDateStr
      });

      await refreshSubjects();
      setShowModal(false);
    } catch (err) {
      setModalError('Failed to update subject exam date.');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleExpandNote = (id) => {
    setExpandedNotes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

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
  for (let i = 0; i < firstDayIndex; i++) {
    cells.push({ day: null, key: `prev-${i}`, classNames: 'calendar-day different-month' });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const today = new Date();
    const isToday = today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;
    const formattedDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const isSelected = formattedDateStr === selectedDateStr;
    
    const dayDeadlines = subjects.filter(s => s.deadline && s.deadline.startsWith(formattedDateStr));
    const dayReminders = reminders.filter(r => r.remind_at && r.remind_at.startsWith(formattedDateStr));

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
      classNames: `calendar-day ${isToday ? 'today' : ''} ${isSelected ? 'selected-day-cell' : ''}`,
      deadlines: dayDeadlines,
      reminders: dayReminders,
      topics: dayTopics
    });
  }

  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // Selected Day Details calculation
  const getSelectedDayDetails = () => {
    const details = {
      dateStr: selectedDateStr,
      formattedDateStr: '',
      deadlines: [],
      reminders: [],
      topics: []
    };

    if (selectedDateStr) {
      const dateObj = new Date(`${selectedDateStr}T00:00:00`);
      details.formattedDateStr = dateObj.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      
      details.deadlines = subjects.filter(s => s.deadline && s.deadline.startsWith(selectedDateStr));
      details.reminders = reminders.filter(r => r.remind_at && r.remind_at.startsWith(selectedDateStr));

      plans.forEach(plan => {
        plan.topics?.forEach((topic, idx) => {
          const topicDateStr = getTopicDateStr(plan.created_at, topic.day);
          if (topicDateStr === selectedDateStr) {
            details.topics.push({
              planId: plan._id || plan.id,
              subjectName: plan.subject_name || plan.subject,
              topicIndex: idx,
              ...topic
            });
          }
        });
      });
    }

    return details;
  };

  const selectedDayInfo = getSelectedDayDetails();

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
        <p className="page-subtitle" style={{ fontSize: '0.78rem', margin: 0 }}>Click a day to view its detailed study topics, notes, and practice quizzes below.</p>
      </div>

      {loadingLocal ? (
        <div className="skeleton" style={{ height: '360px', width: '100%', borderRadius: 'var(--radius-md)' }}></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
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
              {cells.map((c) => {
                const isSelected = c.dateStr === selectedDateStr;
                return (
                  <div 
                    key={c.key} 
                    className={c.classNames}
                    onClick={() => c.day && handleCellClick(c.dateStr)}
                    style={{ 
                      cursor: c.day ? 'pointer' : 'default', 
                      padding: '4px', 
                      minHeight: '80px',
                      border: isSelected ? '2px solid var(--accent-primary)' : '1px solid rgba(255,255,255,0.03)',
                      background: isSelected ? 'rgba(124, 58, 237, 0.05)' : '',
                      transition: 'all 0.2s'
                    }}
                  >
                    {c.day && (
                      <>
                        <div className="calendar-day-number" style={{ fontSize: '0.72rem', fontWeight: isSelected ? 700 : 500 }}>{c.day}</div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px' }}>
                          {/* Exams */}
                          {c.deadlines?.map(sub => (
                            <div 
                              key={sub.id || sub._id} 
                              className="calendar-event"
                              style={{ background: sub.color || 'var(--accent-primary)', fontSize: '0.58rem', padding: '1px 3px', borderRadius: '2px' }}
                              title={`Exam: ${sub.name}`}
                            >
                              📚 {sub.name.slice(0, 8)}..
                            </div>
                          ))}
                          
                          {/* Study Plan Topics */}
                          {c.topics?.map((topic, idx) => {
                            const matchedSub = subjects.find(s => s.name.toLowerCase() === topic.subjectName.toLowerCase());
                            const subColor = matchedSub?.color || 'var(--accent-primary)';
                            
                            return (
                              <div 
                                key={idx} 
                                style={{ 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  gap: '2px', 
                                  fontSize: '0.55rem', 
                                  background: 'rgba(255, 255, 255, 0.03)', 
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
                          
                          {/* Custom Reminders */}
                          {c.reminders?.map((rem, idx) => (
                            <div 
                              key={idx} 
                              className="calendar-event"
                              style={{ background: 'rgba(245, 158, 11, 0.75)', border: '1px solid var(--accent-orange)', fontSize: '0.58rem', padding: '1px 3px', borderRadius: '2px' }}
                              title={`Event: ${rem.message}`}
                            >
                              🔔 {rem.message.slice(0, 8)}..
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '2px', border: '1px solid var(--accent-primary)', display: 'inline-block' }}></span>
              Selected Day
            </div>
          </div>

          {/* 🔍 STUDY CENTER DETAIL CARD (Topics, Notes & Quizzes for selected day) */}
          <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            
            {/* Detail Card Header */}
            <div className="flex-between" style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px' }}>
              <div>
                <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>
                  📖 Study Center: {selectedDayInfo.formattedDateStr}
                </h2>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                  Complete study modules scheduled for this day
                </p>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  className="btn btn-outline btn-xs" 
                  onClick={() => openActionModal('event', selectedDayInfo.dateStr)}
                  style={{ fontSize: '0.68rem', padding: '4px 8px' }}
                >
                  🔔 Add Alert
                </button>
                <button 
                  className="btn btn-outline btn-xs" 
                  onClick={() => openActionModal('deadline', selectedDayInfo.dateStr)}
                  style={{ fontSize: '0.68rem', padding: '4px 8px' }}
                >
                  ⚙️ Reschedule Deadline
                </button>
              </div>
            </div>

            {/* Custom Day Reminders/Alerts List */}
            {selectedDayInfo.reminders.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.15)', padding: '10px', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--accent-orange)', textTransform: 'uppercase' }}>🔔 Custom Alerts for Today:</div>
                <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {selectedDayInfo.reminders.map((rem, idx) => (
                    <li key={idx} style={{ marginBottom: '2px' }}>{rem.message}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Topics List with Notes & Quizzes */}
            {selectedDayInfo.topics.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)' }}>
                <p style={{ fontSize: '0.8rem', margin: 0 }}>No study plan topics scheduled for this date.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {selectedDayInfo.topics.map((topic, idx) => {
                  const matchedSub = subjects.find(s => s.name.toLowerCase() === topic.subjectName.toLowerCase());
                  const subColor = matchedSub?.color || 'var(--accent-primary)';
                  const subId = matchedSub?._id || matchedSub?.id || '';

                  // Filter study notes relevant to this subject
                  const subjectNotes = notes.filter(n => n.subject.toLowerCase() === topic.subjectName.toLowerCase());

                  // Filter quizzes relevant to this subject
                  const subjectQuizzes = quizzes.filter(q => q.subject.toLowerCase() === topic.subjectName.toLowerCase());
                  const quizAttempts = subjectQuizzes.flatMap(q => q.attempts || []);
                  const highQuizScore = quizAttempts.length > 0 ? Math.max(...quizAttempts.map(a => Math.round((a.score / a.total) * 100))) : null;

                  return (
                    <div 
                      key={idx}
                      style={{
                        padding: '12px',
                        background: 'var(--bg-input)',
                        borderRadius: 'var(--radius-md)',
                        borderLeft: `4px solid ${subColor}`,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px'
                      }}
                    >
                      {/* Topic row */}
                      <div className="flex-between">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input 
                            type="checkbox" 
                            checked={topic.completed}
                            onChange={() => handleToggleTopic(topic.planId, topic.topicIndex, topic.completed)}
                            style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                            title="Mark topic as completed"
                          />
                          <div>
                            <span style={{ fontSize: '0.82rem', fontWeight: 700, textDecoration: topic.completed ? 'line-through' : 'none', color: topic.completed ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                              {topic.name}
                            </span>
                            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginLeft: '8px' }}>
                              ({topic.duration} mins target)
                            </span>
                          </div>
                        </div>

                        <span className="badge badge-purple" style={{ fontSize: '0.62rem' }}>
                          Day {topic.day} • {topic.subjectName}
                        </span>
                      </div>

                      {/* Content Row: Notes & Quizzes */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '8px' }}>
                        
                        {/* 📚 Notes for this Topic */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                            📚 Study Guides & Notes ({subjectNotes.length})
                          </div>

                          {subjectNotes.length === 0 ? (
                            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: 0, fontStyle: 'italic' }}>
                              No study notes generated yet. <Link to="/notes" style={{ color: 'var(--accent-light)', textDecoration: 'underline' }}>Create Note</Link>
                            </p>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              {subjectNotes.slice(0, 2).map((note) => {
                                const noteId = note._id || note.id;
                                const isExpanded = !!expandedNotes[noteId];
                                return (
                                  <div key={noteId} style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '8px', borderRadius: '4px' }}>
                                    <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                      {note.type === 'auto_generated' ? '✨ AI Study Guide' : '📝 Manual Summary'}
                                    </div>
                                    <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: '4px 0 0', whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>
                                      {isExpanded ? (note.summary || note.generated_notes) : `${(note.summary || note.generated_notes || '').slice(0, 160)}...`}
                                    </p>
                                    {(note.summary || note.generated_notes || '').length > 160 && (
                                      <button 
                                        className="btn btn-ghost btn-xs" 
                                        onClick={() => toggleExpandNote(noteId)}
                                        style={{ fontSize: '0.6rem', padding: 0, height: 'auto', color: 'var(--accent-light)', marginTop: '2px' }}
                                      >
                                        {isExpanded ? 'Show Less' : 'Read Full Note'}
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                              {subjectNotes.length > 2 && (
                                <Link to="/notes" style={{ fontSize: '0.7rem', color: 'var(--accent-light)', fontWeight: 600 }}>
                                  View all {subjectNotes.length} notes in Study Library →
                                </Link>
                              )}
                            </div>
                          )}
                        </div>

                        {/* 🧩 Quizzes for this Topic */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '8px' }}>
                          <div className="flex-between">
                            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                              🧩 Practice Quizzes
                            </span>
                            {subId && (
                              <Link 
                                to={`/quiz?subject=${subId}`}
                                className="btn btn-primary btn-xs"
                                style={{ fontSize: '0.65rem', padding: '3px 8px' }}
                              >
                                🎯 Practice Quiz Now
                              </Link>
                            )}
                          </div>
                          
                          {quizAttempts.length === 0 ? (
                            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: 0, fontStyle: 'italic' }}>
                              No quiz attempts recorded yet.
                            </p>
                          ) : (
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                                Quiz Attempts: <strong>{quizAttempts.length}</strong>
                              </span>
                              <span style={{ color: 'rgba(255,255,255,0.1)' }}>|</span>
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                                High Score: <strong style={{ color: highQuizScore >= 80 ? 'var(--text-green)' : 'var(--text-red)' }}>{highQuizScore}%</strong>
                              </span>
                            </div>
                          )}
                        </div>

                      </div>

                    </div>
                  );
                })}
              </div>
            )}

          </div>

        </div>
      )}

      {/* Interactive Modal Form (Day Clicking Actions) */}
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
