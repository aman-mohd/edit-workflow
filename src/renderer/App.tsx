import React, { useState, Component, ErrorInfo, ReactNode } from 'react'
import { WorkflowPage } from './pages/WorkflowPage'
import { SettingsPage } from './pages/SettingsPage'

type Page = 'workflow' | 'settings'

class ErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error: Error) {
    return { error: error.message }
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('React error:', error, info)
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 32, color: '#e05252', fontFamily: 'monospace' }}>
          <strong>Something crashed:</strong>
          <pre style={{ marginTop: 12, whiteSpace: 'pre-wrap' }}>{this.state.error}</pre>
          <button
            style={{ marginTop: 16, padding: '8px 16px', cursor: 'pointer' }}
            onClick={() => this.setState({ error: null })}
          >
            Dismiss
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

export function App(): JSX.Element {
  const [page, setPage] = useState<Page>('workflow')

  return (
    <div className="app">
      <nav className="nav-bar">
        <div className="nav-brand">Video Editor Tool</div>
        <div className="nav-links">
          <button
            className={`nav-btn ${page === 'workflow' ? 'active' : ''}`}
            onClick={() => setPage('workflow')}
          >
            Workflow
          </button>
          <button
            className={`nav-btn ${page === 'settings' ? 'active' : ''}`}
            onClick={() => setPage('settings')}
          >
            Settings
          </button>
        </div>
      </nav>

      <main className="main-content">
        <ErrorBoundary>
          {page === 'workflow' && <WorkflowPage />}
          {page === 'settings' && <SettingsPage />}
        </ErrorBoundary>
      </main>
    </div>
  )
}
