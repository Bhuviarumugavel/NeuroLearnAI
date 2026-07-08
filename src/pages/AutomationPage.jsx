import { useState, useEffect } from 'react';
import api from '../utils/api';

export default function AutomationPage() {
  const [health, setHealth] = useState(null);
  const [processes, setProcesses] = useState([]);
  const [robots, setRobots] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Trigger bot form state
  const [selectedProcess, setSelectedProcess] = useState('');
  const [inputArgs, setInputArgs] = useState('{\n  "SubjectName": "Computer Science",\n  "StudentID": "12345"\n}');
  const [triggering, setTriggering] = useState(false);

  const fetchUiPathData = async () => {
    setLoading(true);
    setError('');
    try {
      // 1. Connection health
      const healthRes = await api.get('/api/uipath/health').catch(err => {
        console.error("UiPath health check failed", err);
        return { data: { status: 'error', detail: err.response?.data?.detail || err.message } };
      });
      setHealth(healthRes.data);

      if (healthRes.data?.status !== 'error') {
        // 2. Fetch processes, robots, and jobs in parallel
        const [procRes, robRes, jobsRes] = await Promise.all([
          api.get('/api/uipath/processes').catch(() => ({ data: { processes: [] } })),
          api.get('/api/uipath/robots').catch(() => ({ data: { robots: [] } })),
          api.get('/api/uipath/jobs').catch(() => ({ data: { jobs: [] } }))
        ]);

        setProcesses(procRes.data.processes || []);
        setRobots(robRes.data.robots || []);
        setJobs(jobsRes.data.jobs || []);

        if (procRes.data.processes?.length > 0) {
          setSelectedProcess(procRes.data.processes[0].name);
        }
      }
    } catch (err) {
      setError('Failed to query Orchestrator information.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUiPathData();
  }, []);

  const handleTriggerBot = async (e) => {
    e.preventDefault();
    if (!selectedProcess) {
      setError('Please select a published RPA process first.');
      return;
    }

    setTriggering(true);
    setError('');
    setSuccessMsg('');

    let parsedArgs = null;
    try {
      if (inputArgs.trim()) {
        parsedArgs = JSON.parse(inputArgs);
      }
    } catch (jErr) {
      setError('Input Arguments must be a valid JSON object.');
      setTriggering(false);
      return;
    }

    try {
      const res = await api.post('/api/uipath/trigger', {
        process_name: selectedProcess,
        input_arguments: parsedArgs
      });

      if (res.data.status === 'success') {
        setSuccessMsg(`Process "${selectedProcess}" triggered successfully! Job key: ${res.data.jobs?.[0]?.key || 'N/A'}`);
        // Refresh jobs queue
        const jobsRes = await api.get('/api/uipath/jobs').catch(() => null);
        if (jobsRes) setJobs(jobsRes.data.jobs || []);
      } else {
        setError(res.data.message || 'Failed to trigger process.');
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to communicate with RPA endpoint.');
    } finally {
      setTriggering(false);
    }
  };

  const getStatusBadge = (state) => {
    switch (state?.toLowerCase()) {
      case 'successful':
        return 'badge-green';
      case 'running':
        return 'badge-blue';
      case 'faulted':
      case 'stopped':
        return 'badge-red';
      default:
        return 'badge-purple';
    }
  };

  return (
    <div className="page-container animate-slide-up">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px', marginBottom: '16px' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '1.4rem' }}>🤖 UiPath RPA Bots</h1>
          <p className="page-subtitle" style={{ fontSize: '0.8rem' }}>Trigger and monitor unattended robotic automation tasks</p>
        </div>
        <button onClick={fetchUiPathData} className="btn btn-outline btn-sm" disabled={loading} style={{ padding: '6px 12px', fontSize: '0.75rem' }}>
          {loading ? 'Refreshing...' : '🔄 Refresh Status'}
        </button>
      </div>

      {error && <div className="auth-error text-xs mb-16">{error}</div>}
      {successMsg && <div className="badge badge-green text-xs mb-16" style={{ width: '100%', padding: '10px' }}>{successMsg}</div>}

      {/* 1. Connection Status Summary Bar */}
      {health && (
        <div style={{
          padding: '12px 16px',
          background: health.status === 'connected' ? 'rgba(16, 185, 129, 0.06)' : 'rgba(239, 68, 68, 0.06)',
          border: `1px solid ${health.status === 'connected' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '16px'
        }}>
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 700 }}>
              Orchestrator Link Status: <span style={{ color: health.status === 'connected' ? '#10b981' : '#ef4444' }}>{health.status?.toUpperCase()}</span>
            </div>
            {health.status === 'connected' && (
              <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Org: {health.org} | Tenant: {health.tenant} | Folder ID: {health.folder_id}
              </div>
            )}
            {health.status === 'error' && (
              <div style={{ fontSize: '0.65rem', color: 'var(--accent-red)', marginTop: '2px' }}>
                Error Detail: {health.detail}
              </div>
            )}
          </div>
          <span style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            background: health.status === 'connected' ? '#10b981' : '#ef4444',
            boxShadow: `0 0 10px ${health.status === 'connected' ? 'rgba(16, 185, 129, 0.6)' : 'rgba(239, 68, 68, 0.6)'}`
          }} />
        </div>
      )}

      {loading && !health ? (
        <div className="skeleton" style={{ height: '300px', width: '100%', borderRadius: 'var(--radius-md)' }}></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
          
          {/* Left Column: Trigger Panel + Active Robots */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* Form to Run Bot */}
            <div className="card" style={{ padding: '16px' }}>
              <h3 className="section-title" style={{ fontSize: '0.98rem', marginBottom: '12px' }}>⚡ Trigger RPA Process Bot</h3>
              
              {processes.length === 0 ? (
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>
                  No published processes found in the folder unit.
                </p>
              ) : (
                <form onSubmit={handleTriggerBot} className="flex-col" style={{ gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="bot-process-select" style={{ fontSize: '0.72rem' }}>Target Process</label>
                    <select
                      id="bot-process-select"
                      className="form-input"
                      value={selectedProcess}
                      onChange={(e) => setSelectedProcess(e.target.value)}
                      style={{ background: 'var(--bg-input)', fontSize: '0.8rem', height: '36px', padding: '8px 12px' }}
                    >
                      {processes.map(proc => (
                        <option key={proc.id} value={proc.name}>{proc.name} (v{proc.version})</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="bot-args-input" style={{ fontSize: '0.72rem' }}>Input Arguments (JSON Format)</label>
                    <textarea
                      id="bot-args-input"
                      className="form-input"
                      rows={4}
                      value={inputArgs}
                      onChange={(e) => setInputArgs(e.target.value)}
                      style={{ fontFamily: 'monospace', fontSize: '0.75rem', padding: '8px 12px' }}
                    />
                  </div>

                  <button
                    type="submit"
                    className={`btn btn-primary btn-full ${triggering ? 'btn-loading' : ''}`}
                    disabled={triggering || processes.length === 0}
                    style={{ fontSize: '0.8rem', padding: '10px' }}
                  >
                    {triggering ? 'Launching RPA Bot...' : '🤖 Execute RPA Bot Job'}
                  </button>
                </form>
              )}
            </div>

            {/* Active Robots */}
            <div className="card" style={{ padding: '16px' }}>
              <h3 className="section-title" style={{ fontSize: '0.98rem', marginBottom: '10px' }}>🤖 Configured Unattended Robots</h3>
              {robots.length === 0 ? (
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No Robots registered in folder environment.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {robots.map(rob => (
                    <div key={rob.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.78rem' }}>{rob.name}</div>
                        <div style={{ fontSize: '0.62rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          Machine: {rob.machine_name} | Type: {rob.type}
                        </div>
                      </div>
                      <span className="badge badge-blue" style={{ fontSize: '0.6rem', padding: '2px 6px' }}>Available</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Execution history / Jobs queue */}
          <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column' }}>
            <h3 className="section-title" style={{ fontSize: '0.98rem', marginBottom: '12px' }}>📋 Orchestrator Jobs Queue Log</h3>
            {jobs.length === 0 ? (
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>
                No jobs executed recently.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '420px', overflowY: 'auto', paddingRight: '4px' }}>
                {jobs.map(job => (
                  <div key={job.id} style={{
                    padding: '10px',
                    background: 'var(--bg-input)',
                    borderRadius: 'var(--radius-md)',
                    borderLeft: `3px solid ${job.state === 'Successful' ? '#10b981' : job.state === 'Running' ? '#3b82f6' : '#ef4444'}`,
                    fontSize: '0.75rem'
                  }}>
                    <div className="flex-between" style={{ marginBottom: '4px' }}>
                      <strong style={{ color: 'var(--text-primary)' }}>{job.process_name}</strong>
                      <span className={`badge ${getStatusBadge(job.state)}`} style={{ fontSize: '0.58rem', padding: '1px 5px' }}>
                        {job.state}
                      </span>
                    </div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.65rem' }}>
                      Job ID: {job.id} | Created: {new Date(job.creation_time).toLocaleString()}
                    </div>
                    {job.info && (
                      <div style={{ color: job.state === 'Faulted' ? 'var(--accent-red)' : 'var(--text-muted)', fontSize: '0.65rem', marginTop: '4px', background: 'rgba(0,0,0,0.15)', padding: '4px 6px', borderRadius: '4px' }}>
                        Info: {job.info}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          
        </div>
      )}
    </div>
  );
}
