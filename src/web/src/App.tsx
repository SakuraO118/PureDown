import { Routes, Route } from 'react-router-dom'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Sidebar } from '@/components/Sidebar'
import Home from '@/pages/Home'
import VideoInfo from '@/pages/VideoInfo'
import Downloads from '@/pages/Downloads'
import Settings from '@/pages/Settings'

export default function App() {
  return (
    <div className="h-screen flex overflow-hidden bg-warm-50">
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
    </div>
  )
}
