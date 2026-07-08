/**
 * CalendarPage.jsx — Interactive Vertical Calendar Page.
 * Displays exam dates, study schedule topics, and custom study alerts vertically.
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

  const [currentDate, setCurrentDate] = useState(new Date()); 
  const [selectedDateStr, setSelectedDateStr] = useState(new Date().toISOString().split('T')[0]); // Default selected day

  // Modal Interactive States (for actions)
  const [clickedDateStr, setClickedDateStr] = useState(null); // 'YYYY-MM-DD'
  const [showModal, setShowModal] = useState(false);
  const [modalTab, setModalTab] = useState('event'); // 'event' | 'deadline' | 'edit_topic'
  
  // Form Inputs
  const [eventMessage, setEventMessage] = useState('');
  const [eventType, setEventType] = useState('Personal Event');
  const [targetSubjectId, setTargetSubjectId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  // Edit Topic states
  const [editingTopic, setEditingTopic] = useState(null);
  const [editTopicName, setEditTopicName] = useState('');
  const [editTopicDuration, setEditTopicDuration] = useState(60);

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
        message: `${eventType}: ${eventMessage}`,
        remind_at: remindAt
      });
      
      await refreshAll();
      setShowModal(false);
      setEventMessage('');
      setEventType('Personal Event');
    } catch (err) {
      setModalError('Failed to save calendar event.');
    } finally {
      setSubmitting(false);
    }
  };

  const openEditTopicModal = (planId, topicIndex, name, duration, dateStr) => {
    setClickedDateStr(dateStr);
    setEditingTopic({ planId, topicIndex, name, duration });
    setEditTopicName(name);
    setEditTopicDuration(duration);
    setModalTab('edit_topic');
    setModalError('');
    setShowModal(true);
  };

  const handleUpdateTopicDetails = async (e) => {
    e.preventDefault();
    if (!editTopicName.trim()) return;

    setSubmitting(true);
    setModalError('');
    try {
      await api.put(`/api/study-plans/${editingTopic.planId}/topic-details`, {
        topic_index: editingTopic.topicIndex,
        name: editTopicName,
        duration: Number(editTopicDuration)
      });
      await refreshAll();
      setShowModal(false);
    } catch (err) {
      setModalError('Failed to update topic details.');
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

      await refreshAll();
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
  
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const getTopicDateStr = (planCreatedAt, topicDay) => {
    const start = new Date(planCreatedAt);
    start.setDate(start.getDate() + (topicDay - 1));
    return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
  };

  // Generate day items for vertical timeline
  const verticalDays = [];
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

    verticalDays.push({
      day,
      dateStr: formattedDateStr,
      isToday,
      isSelected,
      deadlines: dayDeadlines,
      reminders: dayReminders,
      topics: dayTopics
    });
  }

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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px', marginBottom: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--accent-light)', fontWeight: 700, letterSpacing: '0.5px' }}>Today</span>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', margin: '2px 0 0' }}>
              {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </h2>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button className="btn btn-outline btn-sm" onClick={() => setCurrentDate(new Date(year, month - 1, 1))} style={{ padding: '4px 8px', fontSize: '0.72rem' }}>◀</button>
            <span style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: '0.82rem', minWidth: '85px', textAlign: 'center' }}>
              {monthNames[month]} {year}
            </span>
            <button className="btn btn-outline btn-sm" onClick={() => setCurrentDate(new Date(year, month + 1, 1))} style={{ padding: '4px 8px', fontSize: '0.72rem' }}>▶</button>
          </div>
        </div>
      </div>

      {loadingLocal ? (
        <div className="skeleton" style={{ height: '360px', width: '100%', borderRadius: 'var(--radius-md)' }}></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Vertical Calendar Scroll Area */}
          <div 
            style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '10px', 
              maxHeight: '480px', 
              overflowY: 'auto', 
              paddingRight: '6px',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '12px',
              background: 'rgba(255,255,255,0.01)'
            }}
          >
            {verticalDays.map((c) => {
              const dateObj = new Date(`${c.dateStr}T00:00:00`);
              const weekdayStr = dateObj.toLocaleDateString(undefined, { weekday: 'short' });
              
              return (
                <div
                  key={c.dateStr}
                  onClick={() => handleCellClick(c.dateStr)}
                  style={{
                    display: 'flex',
                    gap: '12px',
                    padding: '10px 12px',
                    background: c.isSelected ? 'rgba(124, 58, 237, 0.08)' : 'var(--bg-input)',
                    border: `1px solid ${c.isSelected ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: c.isSelected ? '0 0 10px rgba(124, 58, 237, 0.12)' : 'none',
                    position: 'relative'
                  }}
                >
                  {/* Left Column: Date Stamp */}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: '50px',
                    height: '50px',
                    borderRadius: '8px',
                    background: c.isToday ? 'var(--accent-primary)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${c.isToday ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                    color: c.isToday ? '#fff' : 'var(--text-primary)',
                  }}>
                    <span style={{ fontSize: '0.58rem', fontWeight: 600, textTransform: 'uppercase', opacity: 0.8 }}>{weekdayStr}</span>
                    <span style={{ fontSize: '1.05rem', fontWeight: 800 }}>{c.day}</span>
                  </div>

                  {/* Middle Column: Visual details for daily schedule */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', justifyContent: 'center' }}>
                    
                    {/* Exam deadlines */}
                    {c.deadlines.map(sub => (
                      <div 
                        key={sub.id || sub._id} 
                        style={{ 
                          background: 'rgba(239, 68, 68, 0.12)', 
                          border: '1px solid #ef4444', 
                          color: '#ef4444', 
                          fontSize: '0.62rem', 
                          padding: '2px 6px', 
                          borderRadius: '3px',
                          fontWeight: 700,
                          width: 'fit-content'
                        }}
                      >
                        📚 EXAM DEADLINE: {sub.name}
                      </div>
                    ))}

                    {/* Custom Alert/Reminders */}
                    {c.reminders.map((rem, idx) => (
                      <div 
                        key={idx} 
                        style={{ 
                          background: 'rgba(245, 158, 11, 0.12)', 
                          border: '1px solid var(--accent-orange)', 
                          color: 'var(--accent-orange)', 
                          fontSize: '0.62rem', 
                          padding: '2px 6px', 
                          borderRadius: '3px',
                          fontWeight: 600,
                          width: 'fit-content'
                        }}
                      >
                        🔔 ALERT: {rem.message}
                      </div>
                    ))}

                    {/* Subject Topics scheduled */}
                    {c.topics.length === 0 ? (
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        No study topics scheduled.
                      </span>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {c.topics.map((topic, tIdx) => {
                          const matchedSub = subjects.find(s => s.name.toLowerCase() === topic.subjectName.toLowerCase());
                          const subColor = matchedSub?.color || 'var(--accent-primary)';
                          
                          return (
                            <div 
                              key={tIdx}
                              style={{
                                padding: '6px 8px',
                                background: 'rgba(0,0,0,0.12)',
                                borderLeft: `3px solid ${subColor}`,
                                borderRadius: '3px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '8px'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <input 
                                  type="checkbox" 
                                  checked={topic.completed}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    handleToggleTopic(topic.planId, topic.topicIndex, topic.completed);
                                  }}
                                  style={{ width: '13px', height: '13px', cursor: 'pointer' }}
                                />
                                <span style={{ 
                                  fontSize: '0.75rem', 
                                  fontWeight: 600,
                                  color: topic.completed ? 'var(--text-muted)' : 'var(--text-primary)',
                                  textDecoration: topic.completed ? 'line-through' : 'none'
                                }}>
                                  {topic.subjectName}: {topic.name} ({topic.duration}m)
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Right Column: Actions */}
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '4px' }}>
                    <button 
                      className="btn btn-outline btn-xs" 
                      onClick={(e) => { e.stopPropagation(); openActionModal('event', c.dateStr); }}
                      style={{ fontSize: '0.6rem', padding: '2px 5px' }}
                    >
                      + Alert
                    </button>
                    <button 
                      className="btn btn-outline btn-xs" 
                      onClick={(e) => { e.stopPropagation(); openActionModal('deadline', c.dateStr); }}
                      style={{ fontSize: '0.6rem', padding: '2px 5px' }}
                    >
                      Set Exam
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 🔍 STUDY CENTER DETAIL CARD (Topics, Notes & Quizzes for selected day) */}
          <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            
            <div className="flex-between" style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px' }}>
              <div>
                <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>
                  📖 Study Center: {selectedDayInfo.formattedDateStr}
                </h2>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                  Study notes and practice resources for this day
                </p>
              </div>

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
                  ⚙️ Reschedule Exam
                </button>
              </div>
            </div>

            {selectedDayInfo.reminders.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.15)', padding: '10px', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--accent-orange)', textTransform: 'uppercase' }}>🔔 Custom Alerts:</div>
                <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {selectedDayInfo.reminders.map((rem, idx) => (
                    <li key={idx} style={{ marginBottom: '2px' }}>{rem.message}</li>
                  ))}
                </ul>
              </div>
            )}

            {selectedDayInfo.topics.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)' }}>
                <p style={{ fontSize: '0.8rem', margin: 0 }}>No study topics scheduled for this date. Click another date in the timeline to view notes.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {selectedDayInfo.topics.map((topic, idx) => {
                  const matchedSub = subjects.find(s => s.name.toLowerCase() === topic.subjectName.toLowerCase());
                  const subColor = matchedSub?.color || 'var(--accent-primary)';
                  const subId = matchedSub?._id || matchedSub?.id || '';

                  // Filter study notes matching the specific topic name or general subject notes
                  let subjectNotes = notes.filter(n => n.subject.toLowerCase() === topic.subjectName.toLowerCase());
                  const topicKeyword = topic.name.toLowerCase();
                  const topicNotes = subjectNotes.filter(n => 
                    (n.summary || '').toLowerCase().includes(topicKeyword) ||
                    (n.description || '').toLowerCase().includes(topicKeyword)
                  );
                  if (topicNotes.length > 0) {
                    subjectNotes = topicNotes;
                  }

                  // Quizzes
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
                      <div className="flex-between">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input 
                            type="checkbox" 
                            checked={topic.completed}
                            onChange={() => handleToggleTopic(topic.planId, topic.topicIndex, topic.completed)}
                            style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                          />
                          <div>
                            <span style={{ fontSize: '0.82rem', fontWeight: 700, textDecoration: topic.completed ? 'line-through' : 'none', color: topic.completed ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                              {topic.name}
                            </span>
                            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginLeft: '8px' }}>
                              ({topic.duration} mins target)
                            </span>
                            <button
                              type="button"
                              onClick={() => openEditTopicModal(topic.planId, topic.topicIndex, topic.name, topic.duration, selectedDayInfo.dateStr)}
                              style={{ background: 'none', border: 'none', color: 'var(--accent-light)', cursor: 'pointer', fontSize: '0.72rem', marginLeft: '8px', padding: 0 }}
                              title="Edit Topic Details"
                            >
                              ✏️ Edit
                            </button>
                          </div>
                        </div>

                        <span className="badge badge-purple" style={{ fontSize: '0.62rem' }}>
                          Day {topic.day} • {topic.subjectName}
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '8px' }}>
                        
                        {/* 📚 Notes for this Topic */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                            📚 Topic-Specific Notes & Guides ({subjectNotes.length})
                          </div>

                          {subjectNotes.length === 0 ? (
                            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: 0, fontStyle: 'italic' }}>
                              AI is generating notes in the background... <Link to="/notes" style={{ color: 'var(--accent-light)', textDecoration: 'underline' }}>Create Custom Notes</Link>
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
                                      {isExpanded ? (note.summary || note.generated_notes) : `${(note.summary || note.generated_notes || '').slice(0, 200)}...`}
                                    </p>
                                    {(note.summary || note.generated_notes || '').length > 200 && (
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
                            </div>
                          )}
                        </div>

                        {/* Quizzes */}
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
              <h3 style={{ fontSize: '0.98rem' }}>
                {modalTab === 'edit_topic' ? '✏️ Edit Topic details' : `📅 Manage: ${clickedDateStr}`}
              </h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)} style={{ fontSize: '0.9rem', padding: '4px' }}>✕</button>
            </div>
 
            {/* Tabs */}
            {modalTab !== 'edit_topic' && (
              <div style={{ display: 'flex', gap: '6px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px', marginBottom: '16px' }}>
                <button 
                  type="button"
                  className={`btn btn-sm ${modalTab === 'event' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setModalTab('event')}
                  style={{ flex: 1, fontSize: '0.75rem', padding: '6px' }}
                >
                  🔔 Add Alert
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
            )}
 
            {modalError && <div className="auth-error text-xs mb-16">{modalError}</div>}
 
            {/* Tab 1: Custom Event Creation */}
            {modalTab === 'event' && (
              <form onSubmit={handleAddCustomEvent} className="flex-col" style={{ gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.72rem' }}>Event Category</label>
                  <select 
                    className="form-input" 
                    value={eventType} 
                    onChange={(e) => setEventType(e.target.value)}
                    style={{ background: 'var(--bg-input)', fontSize: '0.8rem', height: '36px', padding: '8px 12px' }}
                  >
                    <option value="Unit Test">📚 Unit Test</option>
                    <option value="Semester Exam">🎓 Semester Exam</option>
                    <option value="Assignment">📝 Assignment</option>
                    <option value="Project Review">💻 Project Review</option>
                    <option value="Viva">🗣️ Viva</option>
                    <option value="Personal Event">🌟 Personal Event</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="calendar-event-title" style={{ fontSize: '0.72rem' }}>Event / Test Title</label>
                  <input 
                    id="calendar-event-title"
                    className="form-input" 
                    placeholder="e.g. Midterm exam or Project viva" 
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
                  {submitting ? 'Rescheduling...' : 'Set Exam Date'}
                </button>
              </form>
            )}

            {/* Tab 3: Edit Study Plan Topic Details */}
            {modalTab === 'edit_topic' && (
              <form onSubmit={handleUpdateTopicDetails} className="flex-col" style={{ gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.72rem' }}>Topic Name</label>
                  <input 
                    className="form-input" 
                    value={editTopicName}
                    onChange={(e) => setEditTopicName(e.target.value)}
                    style={{ fontSize: '0.8rem', height: '36px', padding: '8px 12px' }}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.72rem' }}>Focus Duration (minutes)</label>
                  <input 
                    type="number"
                    min={5}
                    className="form-input" 
                    value={editTopicDuration}
                    onChange={(e) => setEditTopicDuration(Number(e.target.value))}
                    style={{ fontSize: '0.8rem', height: '36px', padding: '8px 12px' }}
                    required
                  />
                </div>
                <button 
                  type="submit" 
                  className={`btn btn-primary btn-full ${submitting ? 'btn-loading' : ''}`}
                  disabled={submitting || !editTopicName.trim()}
                  style={{ fontSize: '0.8rem', padding: '10px' }}
                >
                  {submitting ? 'Updating...' : 'Save Changes'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
