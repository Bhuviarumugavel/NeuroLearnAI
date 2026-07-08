import { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';

export default function DashboardPage() {
  const { user } = useAuth();
  const { subjects } = useData();
  const [selectedSubId, setSelectedSubId] = useState('');
  const [hoveredIndex, setHoveredIndex] = useState(null);

  // Auto-select first subject in the list when data is available
  useEffect(() => {
    if (subjects && subjects.length > 0 && !selectedSubId) {
      setSelectedSubId(subjects[0]._id || subjects[0].id);
    }
  }, [subjects, selectedSubId]);

  const activeSub = subjects.find(s => (s._id || s.id) === selectedSubId);
  const activeSubjectName = activeSub ? activeSub.name : 'Neuroscience';
  const displayName = user?.name || user?.email?.split('@')[0] || 'Student';

  // Base dataset matching the screenshot exactly
  const dataPoints = [450, 414, 520, 460, 450, 500, 480, 480, 410, 500, 480, 510];

  // SVG dimensions
  const width = 650;
  const height = 280;
  const paddingLeft = 45;
  const paddingRight = 20;
  const paddingTop = 40;
  const paddingBottom = 35;

  const innerWidth = width - paddingLeft - paddingRight;
  const innerHeight = height - paddingTop - paddingBottom;

  const yMin = 400;
  const yMax = 540;
  const yRange = yMax - yMin;

  // Calculate coordinates for the line chart
  const coords = dataPoints.map((val, i) => {
    const x = paddingLeft + (i / (dataPoints.length - 1)) * innerWidth;
    const y = paddingTop + innerHeight - ((val - yMin) / yRange) * innerHeight;
    return { x, y, val, day: i };
  });

  // SVG Line path string
  const linePath = coords.length > 0
    ? `M ${coords[0].x} ${coords[0].y} ` + coords.slice(1).map(c => `L ${c.x} ${c.y}`).join(' ')
    : '';

  // SVG Area path string to fill under the line
  const areaPath = coords.length > 0
    ? `${linePath} L ${coords[coords.length - 1].x} ${paddingTop + innerHeight} L ${coords[0].x} ${paddingTop + innerHeight} Z`
    : '';

  // Y-axis grid values
  const yGridValues = [400, 420, 440, 460, 480, 500, 520, 540];

  return (
    <div className="page-container animate-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '24px 16px' }}>
      
      {/* Welcome Greeting & Quick Stats */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0, fontFamily: 'Outfit', color: 'var(--text-primary)' }}>
          Welcome back, {displayName}!
        </h1>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
          Here is your daily study focus activity and active session metrics.
        </p>
      </div>

      {/* Professional Stats Cards Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
        gap: '12px',
        width: '100%'
      }}>
        {/* Total Time Card */}
        <div className="card" style={{ padding: '14px 16px', background: 'var(--grad-card)', display: 'flex', flexDirection: 'column', gap: '4px', border: '1px solid var(--border-subtle)' }}>
          <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', fontWeight: 600 }}>Total Focus</span>
          <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'Outfit' }}>5,704m</span>
          <span style={{ fontSize: '0.62rem', color: 'var(--text-green)', fontWeight: 600 }}>⏱️ Accumulated</span>
        </div>

        {/* Highest Session Card */}
        <div className="card" style={{ padding: '14px 16px', background: 'var(--grad-card)', display: 'flex', flexDirection: 'column', gap: '4px', border: '1px solid var(--border-subtle)' }}>
          <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', fontWeight: 600 }}>Peak Session</span>
          <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ef4444', fontFamily: 'Outfit' }}>520m</span>
          <span style={{ fontSize: '0.62rem', color: '#ef4444', fontWeight: 600 }}>▲ Day 2 Highest</span>
        </div>

        {/* Lowest Session Card */}
        <div className="card" style={{ padding: '14px 16px', background: 'var(--grad-card)', display: 'flex', flexDirection: 'column', gap: '4px', border: '1px solid var(--border-subtle)' }}>
          <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', fontWeight: 600 }}>Lowest Session</span>
          <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10b981', fontFamily: 'Outfit' }}>410m</span>
          <span style={{ fontSize: '0.62rem', color: '#10b981', fontWeight: 600 }}>▼ Day 8 Lowest</span>
        </div>

        {/* Active Subject Card */}
        <div className="card" style={{ padding: '14px 16px', background: 'var(--grad-card)', display: 'flex', flexDirection: 'column', gap: '4px', border: '1px solid var(--border-subtle)' }}>
          <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', fontWeight: 600 }}>Average Session</span>
          <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-light)', fontFamily: 'Outfit' }}>475m</span>
          <span style={{ fontSize: '0.62rem', color: 'var(--text-secondary)' }}>📊 12-Day Avg</span>
        </div>
      </div>

      {/* Main Chart Container */}
      <div className="card" style={{ padding: '20px 24px', background: 'var(--grad-card)', display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative', border: '1px solid var(--border)' }}>
        
        {/* Dropdown / Header row */}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '14px' }}>
          <div>
            <h2 style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              📈 Daily Focus Progress & Learning Time
            </h2>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
              Subject: <strong style={{ color: 'var(--accent-light)' }}>{activeSubjectName}</strong>
            </p>
          </div>

          {subjects && subjects.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <select
                id="subject-select"
                value={selectedSubId}
                onChange={(e) => setSelectedSubId(e.target.value)}
                style={{
                  background: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                  padding: '4px 10px',
                  fontSize: '0.75rem',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                {subjects.map(s => (
                  <option key={s._id || s.id} value={s._id || s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* SVG Wrapper */}
        <div style={{ width: '100%', overflowX: 'auto', position: 'relative' }}>
          <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', overflow: 'visible', background: 'transparent' }}>
            <defs>
              <linearGradient id="chartAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Grid & Y-Axis Labels */}
            {yGridValues.map((val, idx) => {
              const y = paddingTop + innerHeight - ((val - yMin) / yRange) * innerHeight;
              return (
                <g key={idx}>
                  {/* Horizontal grid line */}
                  <line
                    x1={paddingLeft}
                    y1={y}
                    x2={width - paddingRight}
                    y2={y}
                    stroke="var(--border-subtle)"
                    strokeWidth="1.0"
                    opacity="0.75"
                  />
                  {/* Y label */}
                  <text
                    x={paddingLeft - 8}
                    y={y + 3}
                    fill="var(--text-muted)"
                    fontSize="10"
                    fontFamily="Inter"
                    fontWeight="500"
                    textAnchor="end"
                  >
                    {val}
                  </text>
                </g>
              );
            })}

            {/* Area path fill under the line */}
            {areaPath && (
              <path
                d={areaPath}
                fill="url(#chartAreaGrad)"
              />
            )}

            {/* X-Axis bottom boundary line */}
            <line
              x1={paddingLeft}
              y1={paddingTop + innerHeight}
              x2={width - paddingRight}
              y2={paddingTop + innerHeight}
              stroke="var(--border-subtle)"
              strokeWidth="1.2"
            />

            {/* Line Connection */}
            {linePath && (
              <path
                d={linePath}
                fill="none"
                stroke="#6366f1"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ filter: 'drop-shadow(0px 3px 6px rgba(99, 102, 241, 0.15))' }}
              />
            )}

            {/* Coordinate Dots & Annotations */}
            {coords.map((c, i) => {
              const isHighest = i === 2; // Day 2 (520) is highest
              const isLowest = i === 8;  // Day 8 (410) is lowest

              return (
                <g key={i}>
                  {/* Custom highest red triangle marker */}
                  {isHighest && (
                    <g>
                      <polygon
                        points={`${c.x},${c.y - 10} ${c.x - 5},${c.y - 3} ${c.x + 5},${c.y - 3}`}
                        fill="#ef4444"
                      />
                      <text
                        x={c.x}
                        y={c.y - 15}
                        fill="var(--text-secondary)"
                        fontSize="10"
                        fontWeight="600"
                        fontFamily="Inter"
                        textAnchor="middle"
                      >
                        ↑ highest
                      </text>
                    </g>
                  )}

                  {/* Custom lowest green 'X' marker */}
                  {isLowest && (
                    <g>
                      <text
                        x={c.x}
                        y={c.y + 4}
                        fill="#10b981"
                        fontSize="13"
                        fontWeight="800"
                        fontFamily="Inter"
                        textAnchor="middle"
                        style={{ cursor: 'pointer' }}
                      >
                        ✕
                      </text>
                      <text
                        x={c.x}
                        y={c.y - 10}
                        fill="var(--text-secondary)"
                        fontSize="10"
                        fontWeight="600"
                        fontFamily="Inter"
                        textAnchor="middle"
                      >
                        ↓ lowest
                      </text>
                    </g>
                  )}

                  {/* Standard point circle indicator */}
                  {!isLowest && (
                    <circle
                      cx={c.x}
                      cy={c.y}
                      r={hoveredIndex === i ? 5.5 : 3.5}
                      fill={isHighest ? '#ef4444' : '#6366f1'}
                      stroke="var(--bg-card)"
                      strokeWidth="1.2"
                      style={{ transition: 'all 0.15s ease', cursor: 'pointer' }}
                      onMouseEnter={() => setHoveredIndex(i)}
                      onMouseLeave={() => setHoveredIndex(null)}
                    />
                  )}
                  {/* Invisible interactive hover area for lowest marker */}
                  {isLowest && (
                    <circle
                      cx={c.x}
                      cy={c.y}
                      r="10"
                      fill="transparent"
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={() => setHoveredIndex(i)}
                      onMouseLeave={() => setHoveredIndex(null)}
                    />
                  )}
                </g>
              );
            })}

            {/* X-Axis Day Labels (0, 2, 4, 6, 8, 10 under corresponding day nodes) */}
            {[0, 2, 4, 6, 8, 10].map((dayIdx) => {
              const c = coords[dayIdx];
              if (!c) return null;
              return (
                <text
                  key={dayIdx}
                  x={c.x}
                  y={paddingTop + innerHeight + 18}
                  fill="var(--text-muted)"
                  fontSize="10"
                  fontFamily="Inter"
                  fontWeight="600"
                  textAnchor="middle"
                >
                  {dayIdx}
                </text>
              );
            })}
          </svg>

          {/* Interactive Tooltip Overlay */}
          {hoveredIndex !== null && coords[hoveredIndex] && (
            <div style={{
              position: 'absolute',
              top: `${coords[hoveredIndex].y - 45}px`,
              left: `${coords[hoveredIndex].x}px`,
              transform: 'translateX(-50%)',
              background: 'rgba(17, 17, 33, 0.95)',
              backdropFilter: 'blur(8px)',
              border: '1px solid var(--border)',
              padding: '5px 10px',
              borderRadius: '6px',
              fontSize: '0.7rem',
              color: 'var(--text-primary)',
              boxShadow: '0 6px 20px rgba(0,0,0,0.5)',
              pointerEvents: 'none',
              zIndex: 100,
              whiteSpace: 'nowrap',
              display: 'flex',
              flexDirection: 'column',
              gap: '1px'
            }}>
              <div style={{ fontWeight: 700, color: 'var(--accent-light)' }}>Day {coords[hoveredIndex].day}</div>
              <div>Active Study Time: <strong>{coords[hoveredIndex].val} mins</strong></div>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
