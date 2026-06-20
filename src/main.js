import React from 'react';
import { createRoot } from 'react-dom/client';

function App() {
  return React.createElement(
    'main',
    { style: { fontFamily: 'sans-serif', padding: '2rem' } },
    React.createElement('h1', null, 'NeurolearnAI'),
    React.createElement('p', null, 'Frontend entry is available.')
  );
}

createRoot(document.getElementById('app')).render(React.createElement(App));
