/**
 * AutomationPage.jsx — UiPath Orchestrator control panel.
 */
import { useState, useEffect } from 'react';
import api from '../utils/api';

function StatusDot({ status }) {
  const colors = { connected: 'var(--accent-green)', error: 'var(--accent-red)', checking: 'var(--accent-orange)' };
  return (
    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: colors[status] || 'var(--text-muted)', marginRight: 6 }} />
  );
}

export default function AutomationPage() {
  const [health, setHealth]       = useState(null);
  const [processes, setProcesses] = useState([]);
  const [jobs, setJobs]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [triggering, setTriggering] = useState(null);
  const [triggerResult, setTriggerResult] = useState(null);

  useEffect(() => {
    Promise.allSettled([
      api.get('/api/uipath/health'),
      api.get('/api/uipath/processes'),
      api.get('/api/uipath/jobs?top=10'),
    ]).then(([h, p, j]) => {
      if (h.status === 'fulfilled') setHealth(h.value.data);
      else setHealth({ status: 'error', detail: h.reason?.response?.data?.detail || 'Connection failed' });
      if (p.status === 'fulfilled') setProcesses(p.value.data.processes || []);
      if (j.status === 'fulfilled') setJobs(j.value.data.jobs || []);
    }).finally(() => setLoading(false));
  }, []);

  const triggerProcess = async (processName) => {
    setTriggering(processName); setTriggerResult(null);
    try {
      const r = await api.post('/api/uipath/trigger', { process_name: processName });
      setTriggerResult({ success: true, msg: `✅ "${processName}" triggered successfully!` });
      // Refresh jobs
      api.get('/api/uipath/jobs?top=10').then((r) => setJobs(r.data.jobs || []));
    } catch (err) {
      setTriggerResult({ success: false, msg: `❌ ${err.response?.data?.detail || 'Failed to trigger'}` });
    } finally { setTriggering(null); }
  };

  const jobStateColor = { Running: 'badge-blue', Successful: 'badge-green', Faulted: 'badge-red', Pending: 'badge-purple', Stopped: 'badge-red' };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">🤖 UiPath Automation</h1>
        <p className="page-subtitle">Control your RPA bots from the study planner</p>
      </div>

      {/* Connection status */}
      <div className="card" style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        {loading ? (
          <><div className="spinner" style={{ width: 20, height: 20 }} /><span style={{ color: 'var(--text-muted)' }}>Connecting to UiPath Orchestrator…</span></>
        ) : (
          <>
            <StatusDot status={health?.status} />
            <div>
              <span style={{ fontWeight: 600, color: health?.status === 'connected' ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                Orchestrator {health?.status === 'connected' ? 'Connected' : 'Disconnected'}
              </span>
              {health?.status === 'connected' && (
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: 12 }}>
                  Org: {health.org} · Folder: {health.folder_id}
                </span>
              )}
              {health?.status === 'error' && (
                <div style={{ fontSize: '0.8rem', color: 'var(--accent-red)', marginTop: 4 }}>{health.detail}</div>
              )}
            </div>
          </>
        )}
      </div>

      {triggerResult && (
        <div className={`card animate-fade-in`} style={{ marginBottom: '16px', borderColor: triggerResult.success ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)', color: triggerResult.success ? 'var(--accent-green)' : 'var(--accent-red)' }}>
          {triggerResult.msg}
        </div>
      )}

      <div className="grid-2">
        {/* Processes */}
        <div>
          <h2 className="section-title"><span>⚙️</span> Available Processes ({processes.length})</h2>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[1,2,3].map((i) => <div key={i} className="skeleton" style={{ height: 60, borderRadius: 10 }} />)}
            </div>
          ) : processes.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🤖</div>
              <p>No processes found. Configure UiPath scopes in the portal.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {processes.map((p) => (
                <div key={p.id} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{p.name}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>v{p.version}</div>
                  </div>
                  <button id={`trigger-${p.name}`}
                    className={`btn btn-primary btn-sm ${triggering === p.name ? 'btn-loading' : ''}`}
                    onClick={() => triggerProcess(p.name)}
                    disabled={!!triggering || health?.status !== 'connected'}>
                    {triggering === p.name ? '' : '▶ Run'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Jobs */}
        <div>
          <h2 className="section-title"><span>📋</span> Recent Jobs</h2>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[1,2,3].map((i) => <div key={i} className="skeleton" style={{ height: 60, borderRadius: 10 }} />)}
            </div>
          ) : jobs.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
              <p>No jobs found.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {jobs.map((j) => (
                <div key={j.id} className="card" style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{j.process_name || 'Unknown'}</div>
                    <span className={`badge ${jobStateColor[j.state] || 'badge-purple'}`}>{j.state}</span>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>
                    ID: {j.id} · {j.creation_time ? new Date(j.creation_time).toLocaleString() : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* UiPath XAML Workflows info */}
      <div className="card mt-24" style={{ borderLeft: '3px solid var(--accent-primary)' }}>
        <h3 style={{ marginBottom: '12px', fontSize: '0.95rem' }}>📂 Automation Workflows (in project)</h3>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {['Main.xaml — Orchestrator entry', 'DailyReport.xaml — Study report generator', 'MaterialScraper.xaml — Web scraper'].map((w) => (
            <span key={w} className="badge badge-purple" style={{ padding: '5px 12px' }}>📄 {w}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
