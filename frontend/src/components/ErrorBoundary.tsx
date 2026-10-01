import { Component, type ReactNode } from 'react'

interface Props { children: ReactNode; fallback?: ReactNode }
interface State { hasError: boolean; error?: Error }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[CivicAid Error]', error, info)
  }

  render() {
    if (!this.state.hasError) return this.props.children
    if (this.props.fallback) return this.props.fallback
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center" style={{ background: '#F5F0E8' }}>
        <div className="flex items-center justify-center rounded-2xl mb-5" style={{ width: 64, height: 64, background: '#FDECEA' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#C0392B" strokeWidth="1.5">
            <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 style={{ fontFamily: 'Inter', fontSize: 20, fontWeight: 700, color: '#1C1C1C', marginBottom: 8 }}>
          Something went wrong
        </h2>
        <p style={{ fontFamily: 'Inter', fontSize: 14, color: '#4A4A4A', marginBottom: 24, maxWidth: 360 }}>
          This section encountered an error. Please refresh the page or navigate to a different section.
        </p>
        <button
          onClick={() => this.setState({ hasError: false })}
          style={{ padding: '10px 24px', borderRadius: 8, background: '#6B9E6B', color: '#FFFFFF', fontFamily: 'Inter', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer' }}
        >
          Try Again
        </button>
        {this.state.error && (
          <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#8A8A8A', marginTop: 16, maxWidth: 400, wordBreak: 'break-all' }}>
            {this.state.error.message}
          </p>
        )}
      </div>
    )
  }
}
