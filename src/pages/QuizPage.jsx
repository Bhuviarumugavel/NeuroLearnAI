/**
 * QuizPage.jsx — AI-generated quizzes.
 */
import { useState, useEffect } from 'react';
import api from '../utils/api';

function QuizQuestion({ q, index, onAnswer, answered }) {
  const [selected, setSelected] = useState(null);

  const handleSelect = (opt) => {
    if (answered) return;
    setSelected(opt);
    onAnswer(index, opt, opt === q.correct_answer);
  };

  const isCorrect = (opt) => answered && opt === q.correct_answer;
  const isWrong   = (opt) => answered && opt === selected && opt !== q.correct_answer;

  return (
    <div className="card animate-fade-in" style={{ marginBottom: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '14px' }}>
        <span style={{ background: 'var(--accent-primary)', color: '#fff', width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700, flexShrink: 0 }}>
          {index + 1}
        </span>
        <p style={{ color: 'var(--text-primary)', fontWeight: 500, lineHeight: 1.5 }}>{q.question}</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {(q.options || []).map((opt, i) => (
          <button key={i} onClick={() => handleSelect(opt)}
            style={{
              padding: '10px 14px', borderRadius: 8, textAlign: 'left',
              cursor: answered ? 'default' : 'pointer',
              border: `1px solid ${isCorrect(opt) ? 'var(--accent-green)' : isWrong(opt) ? 'var(--accent-red)' : selected === opt ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
              background: isCorrect(opt) ? 'rgba(16,185,129,0.1)' : isWrong(opt) ? 'rgba(239,68,68,0.1)' : selected === opt ? 'rgba(124,58,237,0.1)' : 'var(--bg-input)',
              color: 'var(--text-primary)', fontSize: '0.88rem', transition: 'all 0.2s',
            }}>
            {String.fromCharCode(65 + i)}. {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function QuizPage() {
  const [topic, setTopic]       = useState('');
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers]   = useState({});
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [score, setScore]       = useState(null);
  const [history, setHistory]   = useState([]);
  const [histLoading, setHistLoading] = useState(true);

  useEffect(() => {
    api.get('/api/quiz/history').then((r) => setHistory(r.data.quizzes || [])).catch(() => {}).finally(() => setHistLoading(false));
  }, []);

  const generateQuiz = async (e) => {
    e.preventDefault();
    if (!topic.trim()) { setError('Enter a topic.'); return; }
    setError(''); setLoading(true); setQuestions([]); setAnswers({}); setScore(null);
    try {
      const r = await api.post('/api/quiz/generate', { topic, num_questions: 5 });
      setQuestions(r.data.questions || []);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to generate quiz.');
    } finally { setLoading(false); }
  };

  const handleAnswer = (index, opt, correct) => {
    setAnswers((prev) => ({ ...prev, [index]: { selected: opt, correct } }));
  };

  const allAnswered = questions.length > 0 && Object.keys(answers).length === questions.length;

  const submitQuiz = () => {
    const correct = Object.values(answers).filter((a) => a.correct).length;
    setScore({ correct, total: questions.length, pct: Math.round((correct / questions.length) * 100) });
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">🧩 AI Quiz</h1>
        <p className="page-subtitle">Generate a quiz on any topic using AI</p>
      </div>

      {/* Topic form */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <form onSubmit={generateQuiz} id="quiz-generate-form" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <input className="form-input" placeholder="Enter topic (e.g. Photosynthesis, World War II…)" value={topic}
            onChange={(e) => setTopic(e.target.value)} style={{ flex: 1, minWidth: '200px' }} />
          <button type="submit" id="generate-quiz-btn" className={`btn btn-primary ${loading ? 'btn-loading' : ''}`} disabled={loading}>
            {loading ? 'Generating…' : '⚡ Generate Quiz'}
          </button>
        </form>
        {error && <div className="auth-error" style={{ marginTop: '10px' }}>{error}</div>}
      </div>

      {/* Questions */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          <div className="spinner" style={{ margin: '0 auto 12px' }} />
          <p>AI is crafting your quiz…</p>
        </div>
      )}

      {questions.length > 0 && (
        <>
          {questions.map((q, i) => (
            <QuizQuestion key={i} q={q} index={i} onAnswer={handleAnswer} answered={score !== null || !!answers[i]} />
          ))}
          {!score && (
            <button id="submit-quiz-btn" className="btn btn-primary btn-lg" onClick={submitQuiz} disabled={!allAnswered}>
              {allAnswered ? '📊 See Results' : `Answer all ${questions.length} questions`}
            </button>
          )}
        </>
      )}

      {/* Score */}
      {score && (
        <div className="card animate-slide-up" style={{ textAlign: 'center', padding: '32px', marginTop: '16px', background: score.pct >= 70 ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${score.pct >= 70 ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
          <div style={{ fontSize: '3rem', marginBottom: '8px' }}>{score.pct >= 80 ? '🏆' : score.pct >= 60 ? '👍' : '📚'}</div>
          <h2 style={{ fontSize: '2.5rem', color: score.pct >= 70 ? 'var(--accent-green)' : 'var(--accent-red)', marginBottom: '8px' }}>{score.pct}%</h2>
          <p style={{ color: 'var(--text-secondary)' }}>{score.correct} / {score.total} correct</p>
          <button className="btn btn-primary mt-16" onClick={() => { setQuestions([]); setScore(null); setTopic(''); }}>Try Another Quiz</button>
        </div>
      )}

      {/* History */}
      {!loading && questions.length === 0 && (
        <div style={{ marginTop: '32px' }}>
          <h2 className="section-title"><span>📜</span> Recent Quizzes</h2>
          {histLoading ? <div className="skeleton" style={{ height: 80, borderRadius: 12 }} /> :
            history.length === 0 ? <p className="text-muted">No quizzes taken yet.</p> :
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {history.slice(0, 5).map((q, i) => (
                <div key={i} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{q.topic}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(q.created_at || Date.now()).toLocaleDateString()}</div>
                  </div>
                  <span className={`badge ${q.score >= 70 ? 'badge-green' : 'badge-red'}`}>{q.score}%</span>
                </div>
              ))}
            </div>
          }
        </div>
      )}
    </div>
  );
}
