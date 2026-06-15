import React, { useState, useEffect } from 'react'
import { useSettings } from '../hooks/useSettings'
import type { AppSettings } from '../../shared/types'

type AuthStatus = 'unknown' | 'checking' | 'ok' | 'error'

export function SettingsPage(): JSX.Element {
  const { settings, setSettings, saveSettings, saved } = useSettings()
  const [authStatus, setAuthStatus] = useState<AuthStatus>('unknown')
  const [authDetail, setAuthDetail] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)

  const update =
    (key: keyof AppSettings) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setSettings((s) => ({ ...s, [key]: e.target.value }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    saveSettings(settings)
  }

  const checkConnection = async () => {
    setAuthStatus('checking')
    try {
      const result = await window.electronAPI.testConnection()
      const ok = result.upload.startsWith('CLI found')
      setAuthStatus(ok ? 'ok' : 'error')
      setAuthDetail(result.upload)
    } catch (e) {
      setAuthStatus('error')
      setAuthDetail(String(e))
    }
  }

  const handleLogin = async () => {
    setLoggingIn(true)
    setAuthStatus('unknown')
    try {
      await window.electronAPI.cliLogin()
      await checkConnection()
    } catch (e) {
      setAuthStatus('error')
      setAuthDetail(String(e))
    } finally {
      setLoggingIn(false)
    }
  }

  const handleLogout = async () => {
    try {
      await window.electronAPI.cliLogout()
      setAuthStatus('error')
      setAuthDetail('Logged out')
    } catch (e) {
      setAuthDetail(String(e))
    }
  }

  useEffect(() => {
    checkConnection()
  }, [])

  const statusColor = authStatus === 'ok' ? '#4caf50' : authStatus === 'error' ? '#f44336' : '#888'
  const statusText =
    authStatus === 'ok' ? 'Connected' :
    authStatus === 'checking' ? 'Checking...' :
    authStatus === 'error' ? 'Not connected' :
    'Unknown'

  return (
    <div className="settings-page">
      <h1>Settings</h1>

      <div className="auth-section">
        <h2>Higgsfield Account</h2>
        <div className="auth-status-row">
          <span className="auth-dot" style={{ background: statusColor }} />
          <span className="auth-status-text" style={{ color: statusColor }}>{statusText}</span>
          {authStatus === 'ok' && (
            <span className="auth-detail">{authDetail}</span>
          )}
        </div>
        {authStatus === 'error' && (
          <p className="auth-error-detail">{authDetail}</p>
        )}
        <div className="auth-actions">
          <button
            type="button"
            className="btn-primary"
            onClick={handleLogin}
            disabled={loggingIn}
          >
            {loggingIn ? 'Opening browser…' : 'Login with Higgsfield'}
          </button>
          {authStatus === 'ok' && (
            <button
              type="button"
              className="btn-danger"
              onClick={handleLogout}
            >
              Logout
            </button>
          )}
          <button
            type="button"
            className="btn-secondary"
            onClick={checkConnection}
            disabled={authStatus === 'checking'}
          >
            Re-check
          </button>
        </div>
        <p className="hint">
          Opens your browser for a quick one-time login. No API keys needed.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="settings-form">
        <div className="field-group">
          <label htmlFor="output-dir">Output Directory</label>
          <input
            id="output-dir"
            type="text"
            value={settings.outputDirectory}
            onChange={update('outputDirectory')}
            placeholder="/Users/yourname/Videos/output"
          />
          <span className="hint">Absolute path where project folders will be saved</span>
        </div>

        <div className="field-row">
          <div className="field-group">
            <label htmlFor="image-model">Image Model</label>
            <input
              id="image-model"
              type="text"
              value={settings.higgsfieldImageModelId}
              onChange={update('higgsfieldImageModelId')}
              placeholder="nano_banana_2"
            />
          </div>
          <div className="field-group">
            <label htmlFor="video-model">Video Model</label>
            <input
              id="video-model"
              type="text"
              value={settings.higgsfieldVideoModelId}
              onChange={update('higgsfieldVideoModelId')}
              placeholder="seedance_2_0"
            />
          </div>
        </div>

        <div className="form-actions">
          <button type="submit" className="btn-primary">Save Settings</button>
          {saved && <span className="saved-badge">Saved</span>}
        </div>
      </form>
    </div>
  )
}
