import { Routes, Route } from 'react-router-dom'
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
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/video/:id" element={<VideoInfo />} />
          <Route path="/downloads" element={<Downloads />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  )
}
