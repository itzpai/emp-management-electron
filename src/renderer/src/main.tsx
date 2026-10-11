import './assets/main.css'

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

const container = document.getElementById('root') as HTMLElement

if (typeof window === 'undefined' || typeof window.api === 'undefined') {
  // The Electron preload script did not run (e.g. the page was opened in a
  // plain browser tab instead of the Electron window). Render a clear
  // diagnostic instead of crashing on `window.api.*` during render.
  const root = ReactDOM.createRoot(container)
  root.render(
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'system-ui, sans-serif',
        padding: '2rem',
        textAlign: 'center'
      }}
    >
      <div style={{ maxWidth: '560px' }}>
        <h1 style={{ fontSize: '1.25rem', marginBottom: '0.75rem' }}>
          Cannot reach the Electron API
        </h1>
        <p style={{ color: '#555', lineHeight: 1.6 }}>
          <code>window.api</code> is undefined because the preload script did not run. This happens
          when the renderer page is opened outside the Electron app (for example the Vite dev URL in
          a normal browser tab).
        </p>
        <p style={{ color: '#555', lineHeight: 1.6 }}>
          Start the app with <code>npm run dev</code> and use the Electron window that opens.
        </p>
      </div>
    </div>
  )
} else {
  ReactDOM.createRoot(container).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
}
