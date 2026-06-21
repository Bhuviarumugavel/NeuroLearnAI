/**
 * CalendarPage.jsx — Interactive Calendar Page
 * Displays exam dates, deadlines, and study sessions organized subject-wise.
 */
import { useState, useEffect } from 'react';
import api from '../utils/api';

export default function CalendarPage() {
  const [subjects, setSubjects] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);

  const [currentDate, setCurrentDate] = useState(new Date(2026, 5, 21)); // Anchor to June 2026 (matching conversation timeline)

  useEffect(() => {
    Promise.all([
      api.get('/api/subjects'),
      api.get('/api/reminders')
    ]).then(([subsRes, remsRes]) => {
      setSubjects(subsRes.data.subjects || []);
      setReminders(remsRes.data.reminders || []);
    }).catch(err => {
      console.error(err);
    }).finally(() => {
      setLoading(false);
    });
  }, []);

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
    
    // Check for deadlines / reminders on this day
    const formattedDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    // Subjects matching deadline
    const dayDeadlines = subjects.filter(s => {
      if (!s.deadline) return false;
      // standard match for yyyy-mm-dd
      return s.deadline.startsWith(formattedDateStr);
    });

    // Reminders matching remind_at
    const dayReminders = reminders.filter(r => {
      if (!r.remind_at) return false;
      return r.remind_at.startsWith(formattedDateStr);
    });

    cells.push({
      day,
      key: `active-${day}`,
      classNames: `calendar-day ${isToday ? 'today' : ''}`,
      deadlines: dayDeadlines,
      reminders: dayReminders,
    });
  }

  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="page-container animate-slide-up">
      {/* Header */}
      <div className="page-header flex-between">
        <div>
          <h1 className="page-title">📅 Study Calendar</h1>
          <p className="page-subtitle">Track academic schedules, upcoming exams, project deadlines, and study targets</p>
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
          <div className="skeleton" style={{ height: '350px', width: '100%', borderRadius: 'var(--radius-lg)' }}></div>
        </div>
      ) : (
        <div className="card" style={{ padding: '16px', overflow: 'hidden' }}>
          {/* Weekday headers */}
          <div className="calendar-grid" style={{ gridTemplateRows: 'auto' }}>
            {weekdays.map(d => (
              <div key={d} className="calendar-day-header">{d}</div>
            ))}
          </div>

          {/* Monthly Day cells */}
          <div className="calendar-grid" style={{ gridAutoRows: 'minmax(100px, auto)' }}>
            {cells.map((c) => (
              <div key={c.key} className={c.classNames}>
                {c.day && (
                  <>
                    <div className="calendar-day-number">{c.day}</div>
                    
                    {/* Render Subject Deadlines */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '6px' }}>
                      {c.deadlines?.map(sub => (
                        <div 
                          key={sub.id || sub._id} 
                          className="calendar-event"
                          style={{ background: sub.color || 'var(--accent-primary)' }}
                          title={`Exam/Deadline: ${sub.name}`}
                        >
                          📚 Exam: {sub.name}
                        </div>
                      ))}
                      
                      {/* Render Scheduled Alerts */}
                      {c.reminders?.map((rem, idx) => (
                        <div 
                          key={idx} 
                          className="calendar-event"
                          style={{ background: 'rgba(245, 158, 11, 0.7)', border: '1px solid var(--accent-orange)' }}
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
      )}
      
      {/* Legend */}
      <div style={{ display: 'flex', gap: '16px', marginTop: '16px', flexWrap: 'wrap', justifyContent: 'center', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'var(--accent-primary)', display: 'inline-block' }}></span>
          Subject Exams / Milestones
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'var(--accent-orange)', display: 'inline-block' }}></span>
          Custom Study Reminders
        </div>
      </div>
    </div>
  );
}
