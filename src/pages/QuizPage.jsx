/**
 * QuizPage.jsx — Quiz Center Page
 * Evaluates understanding through AI-generated quizzes.
 * A subject is marked Completed if the score is >= 80%; otherwise, it is flagged for a retest.
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { useStudyTimer } from '../context/StudyTimerContext';

function QuizCardQuestion({ q, index, total, selectedOption, onSelectOption }) {
  const options = q.options || [];

  return (
    <div className="card animate-slide-up" style={{ marginBottom: '24px' }}>
      <div className="flex-between mb-16">
        <span className="badge badge-purple">Question {index + 1} of {total}</span>
      </div>
      <h3 style={{ fontSize: '1.05rem', color: 'var(--text-primary)', marginBottom: '20px', fontWeight: 600, lineHeight: 1.5 }}>
        {q.question}
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {options.map((opt, i) => {
          const isSelected = selectedOption === opt;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelectOption(index, opt)}
              style={{
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                textAlign: 'left',
                cursor: 'pointer',
                border: `1px solid ${isSelected ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                background: isSelected ? 'rgba(124,58,237,0.12)' : 'var(--bg-input)',
                color: 'var(--text-primary)',
                fontSize: '0.9rem',
                transition: 'all 0.15s',
                fontWeight: isSelected ? '600' : '500',
              }}
            >
              <strong style={{ color: isSelected ? 'var(--accent-light)' : 'var(--text-muted)', marginRight: '8px' }}>
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
  const { startSession, stopSession } = useStudyTimer();

  const [subjects, setSubjects] = useState([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [quizSource, setQuizSource] = useState('name'); // 'name' | 'notes' | 'custom'
  const [customText, setCustomText] = useState('');
  const [numQuestions, setNumQuestions] = useState(5);
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

  // Past quiz history
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  // Fetch subjects
  useEffect(() => {
    api.get('/api/subjects')
      .then((r) => {
        const list = r.data.subjects || [];
        setSubjects(list);
        if (list.length > 0) {
          setSelectedSubjectId(list[0]._id || list[0].id);
        }
      })
      .catch(() => {});
    loadHistory();
  }, []);

  const loadHistory = () => {
    api.get('/api/quiz/history')
      .then((r) => setHistory(r.data.quizzes || []))
      .catch(() => {})
      .finally(() => setHistoryLoading(false));
  };

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

    const activeSub = subjects.find(s => (s._id || s.id) === selectedSubjectId);
    const subjectName = activeSub ? activeSub.name : 'General';

    // Start background study timer for this subject
    startSession(selectedSubjectId, subjectName);

    // Prepare quiz source text
    let sourceText = '';
    if (quizSource === 'custom') {
      if (!customText.trim()) {
        setError('Please paste study text to generate quiz.');
        setLoading(false);
        return;
      }
      sourceText = customText;
    } else if (quizSource === 'notes') {
      try {
        const notesRes = await api.get(`/api/notes?subject=${encodeURIComponent(subjectName)}`);
        const subNotes = notesRes.data.notes || [];
        if (subNotes.length === 0) {
          setError(`No notes found in Study Library for ${subjectName}. Pushing prompt-based generation fallback.`);
          sourceText = `Create a test on the key educational concepts, terms, definitions, and facts of the course: ${subjectName}`;
        } else {
          sourceText = subNotes.map(n => `${n.title}\n${n.original_text || n.summary}`).join('\n\n');
        }
      } catch (err) {
        sourceText = `Generate MCQ assessment questions on: ${subjectName}`;
      }
    } else {
      sourceText = `Create a multiple-choice academic quiz with questions, options, and answers covering major points of: ${subjectName}`;
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
      setError(err.response?.data?.detail || 'Failed to generate quiz. Please check backend connection.');
      stopSession();
    } finally {
      setLoading(false);
    }
  };

  const handleSelectOption = (qIdx, option) => {
    setSelectedAnswers(prev => ({
      ...prev,
      [qIdx]: option
    }));
  };

  const handleSubmitQuiz = async () => {
    if (Object.keys(selectedAnswers).length < questions.length) {
      setError('Please answer all questions before submitting.');
      return;
    }

    setSubmitting(true);
    setError('');

    // Compile answer list
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

      // Stop study session timer (persists study time metrics)
      stopSession();
      loadHistory();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to submit answers.');
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
    setCustomText('');
  };

  const isCompleted = scoreData?.percentage >= 80;

  return (
    <div className="page-container animate-slide-up">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">🧩 Quiz Center</h1>
        <p className="page-subtitle">Test your knowledge with AI-generated quizzes. Score 80%+ to complete subjects.</p>
      </div>

      {error && <div className="auth-error mb-16">{error}</div>}

      {/* State 1: Configuration Form */}
      {questions.length === 0 && !scoreData && (
        <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '24px', alignItems: 'start' }}>
          {/* Settings Card */}
          <div className="card">
            <h2 className="section-title">⚡ Configure Quiz</h2>
            
            {subjects.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>📚</div>
                <h3>No Subjects Configured</h3>
                <p className="text-muted text-sm mb-16">Create subjects in Subject Settings to test your knowledge.</p>
                <Link to="/subjects" className="btn btn-primary btn-sm">Configure Subjects</Link>
              </div>
            ) : (
              <form onSubmit={handleStartQuiz} className="flex-col" id="quiz-config-form">
                {/* Subject dropdown */}
                <div className="form-group">
                  <label className="form-label" htmlFor="quiz-subject-select">Select Subject</label>
                  <select 
                    id="quiz-subject-select"
                    className="form-input" 
                    value={selectedSubjectId} 
                    onChange={(e) => setSelectedSubjectId(e.target.value)}
                  >
                    {subjects.map(s => (
                      <option key={s._id || s.id} value={s._id || s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                {/* Source Selection */}
                <div className="form-group">
                  <label className="form-label">Quiz Generation Source</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                    <button 
                      type="button" 
                      className={`btn btn-sm ${quizSource === 'name' ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => setQuizSource('name')}
                    >
                      Subject Name
                    </button>
                    <button 
                      type="button" 
                      className={`btn btn-sm ${quizSource === 'notes' ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => setQuizSource('notes')}
                    >
                      Library Notes
                    </button>
                    <button 
                      type="button" 
                      className={`btn btn-sm ${quizSource === 'custom' ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => setQuizSource('custom')}
                    >
                      Custom Text
                    </button>
                  </div>
                </div>

                {/* Custom Text input if selected */}
                {quizSource === 'custom' && (
                  <div className="form-group animate-fade-in">
                    <label className="form-label" htmlFor="quiz-source-text">Paste Study Material</label>
                    <textarea 
                      id="quiz-source-text"
                      className="form-input" 
                      placeholder="Paste notes, slides text, or textbook details to test yourself on..."
                      rows={6}
                      value={customText}
                      onChange={(e) => setCustomText(e.target.value)}
                      required
                    />
                  </div>
                )}

                {/* Question Quantity */}
                <div className="form-group">
                  <label className="form-label" htmlFor="quiz-num-select">Number of Questions</label>
                  <select 
                    id="quiz-num-select"
                    className="form-input" 
                    value={numQuestions} 
                    onChange={(e) => setNumQuestions(Number(e.target.value))}
                  >
                    <option value={5}>5 Questions</option>
                    <option value={10}>10 Questions</option>
                    <option value={15}>15 Questions</option>
                  </select>
                </div>

                {/* Launch Button */}
                <button 
                  type="submit" 
                  id="quiz-start-btn"
                  className={`btn btn-primary btn-full btn-lg ${loading ? 'btn-loading' : ''}`}
                  disabled={loading}
                >
                  {loading ? 'Crafting Questions...' : '🚀 Generate & Start Quiz'}
                </button>
              </form>
            )}
          </div>

          {/* Quiz Attempts History */}
          <div className="card">
            <h3 className="section-title">📜 Recent Quiz Scores</h3>
            {historyLoading ? (
              <div className="skeleton" style={{ height: '140px', width: '100%' }}></div>
            ) : history.length === 0 ? (
              <p className="text-muted text-sm">No quizzes taken yet. Completed quizzes will be logged here.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {history.slice(0, 5).map((h, i) => {
                  const lastAttempt = h.attempts?.[h.attempts.length - 1];
                  const scorePct = lastAttempt ? Math.round((lastAttempt.score / lastAttempt.total) * 100) : 0;
                  
                  return (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{h.subject}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {lastAttempt ? new Date(lastAttempt.attempted_at).toLocaleDateString() : 'N/A'}
                        </div>
                      </div>
                      <span className={`badge ${scorePct >= 80 ? 'badge-green' : 'badge-red'}`}>
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
        <div style={{ maxWidth: '640px', margin: '0 auto' }}>
          <QuizCardQuestion 
            q={questions[currentIdx]} 
            index={currentIdx} 
            total={questions.length} 
            selectedOption={selectedAnswers[currentIdx]}
            onSelectOption={handleSelectOption}
          />
          
          <div className="flex-between">
            <button 
              className="btn btn-outline" 
              onClick={() => setCurrentIdx(prev => Math.max(0, prev - 1))}
              disabled={currentIdx === 0}
            >
              ⬅️ Previous
            </button>

            {currentIdx < questions.length - 1 ? (
              <button 
                className="btn btn-outline" 
                onClick={() => setCurrentIdx(prev => prev + 1)}
                disabled={!selectedAnswers[currentIdx]}
              >
                Next ➡️
              </button>
            ) : (
              <button 
                id="quiz-submit-btn"
                className={`btn btn-primary ${submitting ? 'btn-loading' : ''}`}
                onClick={handleSubmitQuiz}
                disabled={submitting || Object.keys(selectedAnswers).length < questions.length}
              >
                {submitting ? 'Submitting...' : '📊 Complete & Score'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* State 3: Quiz Score Card & Question Breakdown */}
      {scoreData && (
        <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Main Results Card */}
          <div 
            className="card animate-slide-up" 
            style={{ 
              textAlign: 'center', 
              padding: '32px',
              borderLeft: `4px solid ${isCompleted ? 'var(--accent-green)' : 'var(--accent-red)'}`,
              background: isCompleted ? 'rgba(16,185,129,0.03)' : 'rgba(239,68,68,0.03)'
            }}
          >
            <div style={{ fontSize: '3rem', marginBottom: '8px' }}>{isCompleted ? '🏆' : '📚'}</div>
            <h2 style={{ fontSize: '2.5rem', color: isCompleted ? 'var(--accent-green)' : 'var(--accent-red)', marginBottom: '8px' }}>
              {scoreData.percentage}%
            </h2>
            
            {isCompleted ? (
              <div className="badge badge-green mb-8" style={{ fontSize: '0.8rem', padding: '6px 16px' }}>Subject Completed</div>
            ) : (
              <div className="badge badge-red mb-8" style={{ fontSize: '0.8rem', padding: '6px 16px' }}>Retest Required (Below 80%)</div>
            )}
            
            <p style={{ color: 'var(--text-secondary)' }}>
              You got {scoreData.score} out of {scoreData.total} questions correct.
            </p>
            <button className="btn btn-primary mt-24" onClick={handleReset}>Try Another Quiz</button>
          </div>

          {/* Questions Review list */}
          <div className="card">
            <h3 className="section-title mb-16">📋 Question Review</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {scoreData.results.map((r, i) => (
                <div 
                  key={i} 
                  style={{ 
                    padding: '16px', 
                    borderRadius: 'var(--radius-md)', 
                    background: 'var(--bg-input)',
                    borderLeft: `3px solid ${r.is_correct ? 'var(--accent-green)' : 'var(--accent-red)'}` 
                  }}
                >
                  <p style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '8px' }}>
                    {i + 1}. {r.question}
                  </p>
                  <div style={{ fontSize: '0.85rem' }}>
                    <div style={{ color: r.is_correct ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                      <strong>Your Answer:</strong> {r.your_answer}
                    </div>
                    {!r.is_correct && (
                      <div style={{ color: 'var(--accent-green)', marginTop: '4px' }}>
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
