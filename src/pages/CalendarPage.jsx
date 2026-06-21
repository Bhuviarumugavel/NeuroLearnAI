/**
 * CalendarPage.jsx — Interactive Calendar Page
 * Displays exam dates, deadlines, study sessions, and day-wise topic progress organized subject-wise.
 */
import { useState, useEffect } from 'react';
import api from '../utils/api';

export default function CalendarPage() {
  const [subjects, setSubjects] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  const [currentDate, setCurrentDate] = useState(new Date(2026, 5, 21)); // Anchor to June 2026 (matching conversation timeline)

  const loadCalendarData = () => {
    Promise.all([
      api.get('/api/subjects'),
      api.get('/api/reminders'),
      api.get('/api/study-plans')
    ]).then(([subsRes, remsRes, plansRes]) => {
      setSubjects(subsRes.data.subjects || []);
      setReminders(remsRes.data.reminders || []);
      setPlans(plansRes.data.plans || []);
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
      
      // Sync subject progress
      loadCalendarData();
    } catch (err) {
      console.error("Failed to update topic progress", err);
      // Reload plans on failure
      api.get('/api/study-plans').then(r => setPlans(r.data.plans || []));
    }
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Calendar calculations
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();
  
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Helper to parse day-wise topic dates
  const getTopicDateStr = (planCreatedAt, topicDay) => {
    const start = new Date(planCreatedAt);
    start.setDate(start.getDate() + (topicDay - 1));
    return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
  };

  // Generate date cells
  const cells = [];
  
  // Empty slots for previous month offset
  for (let i = 0; i < firstDayIndex; i++) {
    cells.push({ day: null, key: `prev-${i}`, classNames: 'calendar-day different-month' });
  }

  // Active month slots
  const today = new Date();
  for (let day = 1; day <= daysInMonth; day++) {
    const isToday = today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;
    const formattedDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    // Subjects matching deadline
    const dayDeadlines = subjects.filter(s => s.deadline && s.deadline.startsWith(formattedDateStr));

    // Reminders matching remind_at
    const dayReminders = reminders.filter(r => r.remind_at && r.remind_at.startsWith(formattedDateStr));

    // Topics matching day-wise plan schedule
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
      <div className="page-header flex-between">
        <div>
          <h1 className="page-title">📅 Study Calendar</h1>
          <p className="page-subtitle">Track academic schedules, topic milestones, exams, and study targets</p>
        </div>
        
        {/* Navigation Month Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button className="btn btn-outline btn-sm" onClick={handlePrevMonth}>◀ Previous</button>
          <span style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: '1.1rem', minWidth: '150px', textAlign: 'center' }}>
            {monthNames[month]} {year}
          </span>
          <button className="btn btn-outline btn-sm" onClick={handleNextMonth}>Next ▶</button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div className="skeleton" style={{ height: '400px', width: '100%', borderRadius: 'var(--radius-lg)' }}></div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2.8fr', gap: '24px', alignItems: 'start' }}>
          
          {/* Left Column: Topic-wise Progress Panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="card">
              <h2 className="section-title">📊 Topic Progress</h2>
              {plans.length === 0 ? (
                <p className="text-muted text-sm">No active AI study plans found. Plans are generated when you add a subject.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {plans.map(plan => {
                    const matchedSub = subjects.find(s => s.name === plan.subject_name);
                    const subColor = matchedSub?.color || 'var(--accent-primary)';
                    
                    return (
                      <div key={plan._id || plan.id} style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '16px' }}>
                        <div className="flex-between mb-8">
                          <span style={{ fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ width: 10, height: 10, borderRadius: '50%', background: subColor }} />
                            {plan.subject_name}
                          </span>
                          <span className="badge badge-purple">{plan.overall_progress ?? 0}%</span>
                        </div>
                        
                        {/* Progress Bar */}
                        <div style={{ width: '100%', height: 6, background: 'var(--bg-input)', borderRadius: 3, overflow: 'hidden', marginBottom: '12px' }}>
                          <div style={{ width: `${plan.overall_progress ?? 0}%`, height: '100%', background: subColor }} />
                        </div>

                        {/* Topics List checklist */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto', paddingRight: '4px' }}>
                          {plan.topics?.map((topic, idx) => (
                            <label key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.8rem' }}>
                              <input 
                                type="checkbox" 
                                checked={topic.completed} 
                                onChange={() => handleToggleTopic(plan._id || plan.id, idx, topic.completed)}
                                style={{ accentColor: subColor }}
                              />
                              <span style={{ textDecoration: topic.completed ? 'line-through' : 'none', color: topic.completed ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                                Day {topic.day}: {topic.name}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Calendar Grid */}
          <div className="card" style={{ padding: '16px', overflow: 'hidden' }}>
            {/* Weekday headers */}
            <div className="calendar-grid" style={{ gridTemplateRows: 'auto' }}>
              {weekdays.map(d => (
                <div key={d} className="calendar-day-header">{d}</div>
              ))}
            </div>

            {/* Monthly Day cells */}
            <div className="calendar-grid" style={{ gridAutoRows: 'minmax(120px, auto)' }}>
              {cells.map((c) => (
                <div key={c.key} className={c.classNames}>
                  {c.day && (
                    <>
                      <div className="calendar-day-number">{c.day}</div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' }}>
                        {/* Day Deadlines */}
                        {c.deadlines?.map(sub => (
                          <div 
                            key={sub.id || sub._id} 
                            className="calendar-event"
                            style={{ background: sub.color || 'var(--accent-primary)', fontSize: '0.7rem', padding: '2px 6px' }}
                            title={`Exam/Deadline: ${sub.name}`}
                          >
                            📚 Exam: {sub.name}
                          </div>
                        ))}
                        
                        {/* Day Study Plan Topics */}
                        {c.topics?.map((topic, idx) => {
                          const matchedSub = subjects.find(s => s.name === topic.subjectName);
                          const subColor = matchedSub?.color || 'var(--accent-primary)';
                          
                          return (
                            <label 
                              key={idx} 
                              style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '4px', 
                                fontSize: '0.7rem', 
                                background: 'rgba(255, 255, 255, 0.04)', 
                                borderLeft: `3px solid ${subColor}`,
                                padding: '2px 4px', 
                                borderRadius: '3px', 
                                cursor: 'pointer' 
                              }} 
                              title={`Subject: ${topic.subjectName} | Day ${topic.day}: ${topic.name}`}
                            >
                              <input 
                                type="checkbox" 
                                checked={topic.completed} 
                                onChange={() => handleToggleTopic(topic.planId, topic.topicIndex, topic.completed)}
                                style={{ width: '11px', height: '11px', accentColor: subColor }}
                              />
                              <span style={{ 
                                textDecoration: topic.completed ? 'line-through' : 'none', 
                                textOverflow: 'ellipsis', 
                                overflow: 'hidden', 
                                whiteSpace: 'nowrap',
                                color: topic.completed ? 'var(--text-muted)' : 'var(--text-primary)' 
                              }}>
                                {topic.name}
                              </span>
                            </label>
                          );
                        })}
                        
                        {/* Custom Alerts */}
                        {c.reminders?.map((rem, idx) => (
                          <div 
                            key={idx} 
                            className="calendar-event"
                            style={{ background: 'rgba(245, 158, 11, 0.7)', border: '1px solid var(--accent-orange)', fontSize: '0.7rem', padding: '2px 6px' }}
                            title={`Study Alert: ${rem.message}`}
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

        </div>
      )}
      
      {/* Legend */}
      <div style={{ display: 'flex', gap: '16px', marginTop: '16px', flexWrap: 'wrap', justifyContent: 'center', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'var(--accent-primary)', display: 'inline-block' }}></span>
          Subject Exams / Deadlines
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'rgba(245, 158, 11, 0.7)', display: 'inline-block' }}></span>
          Custom Study Reminders
        </div>
      </div>
    </div>
  );
}
