import { useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useGameStore } from './store'
import { GameView } from './GameView'
import { AdminView } from './AdminView'

const queryClient = new QueryClient()

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

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/"      element={<GameWrapper />} />
          <Route path="/admin" element={<AdminView />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
