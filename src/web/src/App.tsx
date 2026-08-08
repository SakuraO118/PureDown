import { Routes, Route } from 'react-router-dom'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Sidebar } from '@/components/Sidebar'
import Home from '@/pages/Home'
import VideoInfo from '@/pages/VideoInfo'
import Downloads from '@/pages/Downloads'
import Settings from '@/pages/Settings'

export default function App() {
  return (
    <div className="h-screen flex overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/video/:id" element={<VideoInfo />} />
            <Route path="/downloads" element={<Downloads />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </ErrorBoundary>
      </main>
      {/* Version — fixed bottom-right */}
      <p className="fixed bottom-3 right-4 text-[11px] text-ink-400/60 select-none pointer-events-none z-50">
        v0.1.0
      </p>
    </div>
  )
}
