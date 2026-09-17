import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import App from './App'
import './index.css'

// 可视化编辑器的样式覆盖：仅开发环境加载，生产构建不打包
if (import.meta.env.DEV) {
  void import('./dev-overrides.css')
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 10_000 },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        <Toaster theme="light" position="top-right" richColors closeButton />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
)
