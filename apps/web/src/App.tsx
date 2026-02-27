import { useEffect, Component, type ReactNode } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useGameStore } from './store'
import { GameView } from './GameView'
import { AdminView } from './AdminView'

const queryClient = new QueryClient()

// ── Error boundary ───────────────────────────────────────────────────────────

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    const { error } = this.state
    if (error) {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#080d12', color: '#f25f52', fontFamily: 'monospace', padding: 32, flexDirection: 'column', gap: 16,
        }}>
          <div style={{ fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', opacity: 0.6 }}>Unhandled Error</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{error.message}</div>
          <button
            onClick={() => this.setState({ error: null })}
            style={{ marginTop: 8, padding: '8px 24px', background: '#1a2840', border: '1px solid #f25f52', color: '#f25f52', borderRadius: 6, cursor: 'pointer', fontFamily: 'monospace' }}
          >
            Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

// ── Game wrapper ─────────────────────────────────────────────────────────────

function GameWrapper() {
  const phase = useGameStore(s => s.phase)
  const tick  = useGameStore(s => s.tick)

  useEffect(() => {
    if (phase !== 'playing') return
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [phase, tick])

  return <GameView />
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route path="/"      element={<GameWrapper />} />
            <Route path="/admin" element={<AdminView />} />
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
