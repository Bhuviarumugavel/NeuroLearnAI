/**
 * QuizPage.jsx — Simplified Quiz Center.
 * Generates an AI-powered 10-question quiz immediately after selecting a subject.
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { useData } from '../context/DataContext';
import { useStudyTimer } from '../context/StudyTimerContext';

function QuizCardQuestion({ q, index, total, selectedOption, onSelectOption }) {
  const options = q.options || [];

  return (
    <div className="card animate-slide-up" style={{ marginBottom: '16px', padding: '16px' }}>
      <div className="flex-between mb-8">
        <span className="badge badge-purple" style={{ fontSize: '0.65rem' }}>Question {index + 1} of {total}</span>
      </div>
      <h3 style={{ fontSize: '0.92rem', color: 'var(--text-primary)', marginBottom: '16px', fontWeight: 600, lineHeight: 1.4 }}>
        {q.question}
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {options.map((opt, i) => {
          const isSelected = selectedOption === opt;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelectOption(index, opt)}
              style={{
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                textAlign: 'left',
                cursor: 'pointer',
                border: `1px solid ${isSelected ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                background: isSelected ? 'rgba(124,58,237,0.1)' : 'var(--bg-input)',
                color: 'var(--text-primary)',
                fontSize: '0.82rem',
                transition: 'all 0.15s',
                fontWeight: isSelected ? '600' : '500',
              }}
            >
              <strong style={{ color: isSelected ? 'var(--accent-light)' : 'var(--text-muted)', marginRight: '6px' }}>
                {String.fromCharCode(65 + i)}.
              </strong>
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function QuizPage() {
  const { subjects, quizzes, refreshQuizzes, refreshSummary } = useData();
  const { startSession, stopSession } = useStudyTimer();

  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [numQuestions] = useState(10); // Default to 10 questions
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Active Quiz State
  const [activeQuizId, setActiveQuizId] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [currentIdx, setCurrentIdx] = useState(0);

  // Scored Result State
  const [scoreData, setScoreData] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Pre-select first subject in list
  useEffect(() => {
    if (subjects.length > 0 && !selectedSubjectId) {
      setSelectedSubjectId(subjects[0]._id || subjects[0].id);
    }
  }, [subjects, selectedSubjectId]);

  const activeSub = subjects.find(s => (s._id || s.id) === selectedSubjectId);
  const subjectName = activeSub ? activeSub.name : '';

  const handleStartQuiz = async (e) => {
    e.preventDefault();
    if (!selectedSubjectId) {
      setError('Please add a subject in Subject Settings first.');
      return;
    }

    setLoading(true);
    setError('');
    setQuestions([]);
    setSelectedAnswers({});
    setCurrentIdx(0);
    setScoreData(null);

    // Start background focus timer session
    startSession(selectedSubjectId, subjectName);

    // Prepare quiz source text. Use notes by default or fallback to subject name.
    let sourceText = '';
    try {
      const notesRes = await api.get(`/api/notes?subject=${encodeURIComponent(subjectName)}`);
      const subNotes = notesRes.data.notes || [];
      if (subNotes.length === 0) {
        sourceText = `Create a test on the key concepts of the course: ${subjectName}`;
      } else {
        sourceText = subNotes.map(n => `${n.title || ''}\n${n.original_text || n.summary}`).join('\n\n');
      }
    } catch (err) {
      sourceText = `Generate MCQ assessment questions on: ${subjectName}`;
    }

    try {
      const res = await api.post('/api/quiz/generate', {
        text: sourceText,
        subject: subjectName,
        num_questions: numQuestions
      });

      if (res.data.questions && res.data.questions.length > 0) {
        setQuestions(res.data.questions);
        setActiveQuizId(res.data.quiz_id);
      } else {
        throw new Error("No questions returned");
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to generate quiz. Check connection.');
      stopSession();
    } finally {
      setLoading(false);
    }
  };

  const handleSelectOption = (qIdx, option) => {
    setSelectedAnswers(prev => ({ ...prev, [qIdx]: option }));
  };

  const handleSubmitQuiz = async () => {
    if (Object.keys(selectedAnswers).length < questions.length) {
      setError('Please answer all questions before submitting.');
      return;
    }

    setSubmitting(true);
    setError('');

    const answersList = [];
    for (let i = 0; i < questions.length; i++) {
      answersList.push(selectedAnswers[i] || "");
    }

    try {
      const res = await api.post('/api/quiz/submit', {
        quiz_id: activeQuizId,
        answers: answersList
      });

      setScoreData({
        score: res.data.score,
        total: res.data.total,
        percentage: res.data.percentage,
        results: res.data.results
      });

      stopSession();
      // Update global context states
      await Promise.all([refreshQuizzes(), refreshSummary()]);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to score quiz.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setQuestions([]);
    setActiveQuizId(null);
    setSelectedAnswers({});
    setScoreData(null);
    setCurrentIdx(0);
  };

  const isCompleted = scoreData?.percentage >= 80;

  return (
    <div className="page-container animate-slide-up">
      {/* Header */}
      <div>
        <h1 className="page-title" style={{ fontSize: '1.4rem' }}>🧩 Quiz Center</h1>
        <p className="page-subtitle" style={{ fontSize: '0.8rem' }}>Score 80%+ on AI-crafted quizzes to complete subjects</p>
      </div>

      {error && <div className="auth-error text-xs mb-16">{error}</div>}

      {/* State 1: Configuration Form */}
      {questions.length === 0 && !scoreData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Settings Card */}
          <div className="card" style={{ padding: '16px' }}>
            <h2 className="section-title" style={{ fontSize: '1rem', marginBottom: '12px' }}>⚡ Start Subject Quiz</h2>
            
            {subjects.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '10px' }}>No subjects added yet.</p>
                <Link to="/subjects" className="btn btn-primary btn-sm">Configure Subjects</Link>
              </div>
            ) : (
              <form onSubmit={handleStartQuiz} className="flex-col" style={{ gap: '12px' }}>
                
                {/* Subject Selector */}
                <div className="form-group">
                  <label className="form-label" htmlFor="quiz-subject-select" style={{ fontSize: '0.75rem' }}>Select Subject</label>
                  <select 
                    id="quiz-subject-select"
                    className="form-input" 
                    value={selectedSubjectId} 
                    onChange={(e) => setSelectedSubjectId(e.target.value)}
                    style={{ background: 'var(--bg-input)', fontSize: '0.8rem', height: '38px', padding: '8px 12px' }}
                  >
                    {subjects.map(s => (
                      <option key={s._id || s.id} value={s._id || s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', background: 'var(--bg-input)', padding: '10px', borderRadius: 'var(--radius-md)' }}>
                  📝 This will start a <strong>10-question</strong> MCQ quiz based on your subject notes library.
                </div>

                <button 
                  type="submit" 
                  className={`btn btn-primary btn-full ${loading ? 'btn-loading' : ''}`}
                  disabled={loading}
                  style={{ padding: '10px 16px', fontSize: '0.85rem' }}
                >
                  {loading ? 'Crafting Quiz...' : '🚀 Start Quiz'}
                </button>
              </form>
            )}
          </div>

          {/* Past quiz history */}
          <div className="card" style={{ padding: '16px' }}>
            <h3 className="section-title" style={{ fontSize: '0.95rem', marginBottom: '8px' }}>📜 Recent Quiz Scores</h3>
            {quizzes.length === 0 ? (
              <p className="text-muted text-xs">No quizzes taken yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {quizzes.slice(0, 4).map((h, i) => {
                  const lastAttempt = h.attempts?.[h.attempts.length - 1];
                  const scorePct = lastAttempt ? Math.round((lastAttempt.score / lastAttempt.total) * 100) : 0;
                  
                  return (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.78rem' }}>{h.subject}</div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {lastAttempt ? new Date(lastAttempt.attempted_at).toLocaleDateString() : 'N/A'}
                        </div>
                      </div>
                      <span className={`badge ${scorePct >= 80 ? 'badge-green' : 'badge-red'}`} style={{ fontSize: '0.65rem', padding: '2px 6px' }}>
                        {scorePct}%
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* State 2: Active Quiz-taking Carousel */}
      {questions.length > 0 && !scoreData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <QuizCardQuestion 
            q={questions[currentIdx]} 
            index={currentIdx} 
            total={questions.length} 
            selectedOption={selectedAnswers[currentIdx]}
            onSelectOption={handleSelectOption}
          />
          
          <div className="flex-between">
            <button 
              className="btn btn-outline btn-sm" 
              onClick={() => setCurrentIdx(prev => Math.max(0, prev - 1))}
              disabled={currentIdx === 0}
              style={{ padding: '6px 12px', fontSize: '0.78rem' }}
            >
              ⬅️ Prev
            </button>

            {currentIdx < questions.length - 1 ? (
              <button 
                className="btn btn-outline btn-sm" 
                onClick={() => setCurrentIdx(prev => prev + 1)}
                disabled={!selectedAnswers[currentIdx]}
                style={{ padding: '6px 12px', fontSize: '0.78rem' }}
              >
                Next ➡️
              </button>
            ) : (
              <button 
                className={`btn btn-primary btn-sm ${submitting ? 'btn-loading' : ''}`}
                onClick={handleSubmitQuiz}
                disabled={submitting || Object.keys(selectedAnswers).length < questions.length}
                style={{ padding: '6px 12px', fontSize: '0.78rem' }}
              >
                {submitting ? 'Submitting...' : '📊 Score Quiz'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* State 3: Quiz Score Card & Question Breakdown */}
      {scoreData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div 
            className="card animate-slide-up" 
            style={{ 
              textAlign: 'center', 
              padding: '20px',
              borderLeft: `4px solid ${isCompleted ? 'var(--accent-green)' : 'var(--accent-red)'}`,
              background: isCompleted ? 'rgba(16,185,129,0.03)' : 'rgba(239,68,68,0.03)'
            }}
          >
            <div style={{ fontSize: '2rem', marginBottom: '4px' }}>{isCompleted ? '🏆' : '📚'}</div>
            <h2 style={{ fontSize: '1.8rem', color: isCompleted ? 'var(--accent-green)' : 'var(--accent-red)', marginBottom: '4px' }}>
              {scoreData.percentage}%
            </h2>
            
            {isCompleted ? (
              <div className="badge badge-green mb-8" style={{ fontSize: '0.65rem' }}>Passed (Retest Cleared)</div>
            ) : (
              <div className="badge badge-red mb-8" style={{ fontSize: '0.65rem' }}>Failed (Requires Retest)</div>
            )}
            
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
              Correct answers: {scoreData.score} / {scoreData.total} questions.
            </p>
            <button className="btn btn-primary btn-sm mt-16" onClick={handleReset}>Try Another Quiz</button>
          </div>

          <div className="card" style={{ padding: '16px' }}>
            <h3 className="section-title" style={{ fontSize: '0.95rem', marginBottom: '8px' }}>📋 Question Review</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '300px', overflowY: 'auto' }}>
              {scoreData.results.map((r, i) => (
                <div 
                  key={i} 
                  style={{ 
                    padding: '10px', 
                    borderRadius: 'var(--radius-md)', 
                    background: 'var(--bg-input)',
                    borderLeft: `3px solid ${r.is_correct ? 'var(--accent-green)' : 'var(--accent-red)'}` 
                  }}
                >
                  <p style={{ fontWeight: 600, fontSize: '0.78rem', color: 'var(--text-primary)', marginBottom: '4px' }}>
                    {i + 1}. {r.question}
                  </p>
                  <div style={{ fontSize: '0.72rem' }}>
                    <div style={{ color: r.is_correct ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                      <strong>Your Answer:</strong> {r.your_answer}
                    </div>
                    {!r.is_correct && (
                      <div style={{ color: 'var(--accent-green)', marginTop: '2px' }}>
                        <strong>Correct Answer:</strong> {r.correct_answer}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
