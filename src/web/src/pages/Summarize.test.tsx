import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Summarize from './Summarize'

const { previewAnalysis } = vi.hoisted(() => ({ previewAnalysis: vi.fn() }))
vi.mock('@/lib/api', () => ({ api: { previewAnalysis, createAnalysis: vi.fn() } }))

describe('summary preview', () => {
  beforeEach(() => previewAnalysis.mockReset())

  it('shows playlist confirmation and optional overview', async () => {
    previewAnalysis.mockResolvedValue({
      url: 'https://example.com/list', title: '课程', kind: 'playlist', duration: 0,
      entries: [{ id: '1', title: '第一集', url: 'https://example.com/1', duration: 600, position: 1 }],
      totalDuration: 600, overLimit: false, maxItems: 20,
    })
    render(<MemoryRouter><Summarize /></MemoryRouter>)
    await userEvent.type(screen.getByPlaceholderText(/播放列表/), 'https://example.com/list')
    await userEvent.click(screen.getByRole('button', { name: '预览' }))
    expect(await screen.findByText('课程')).toBeTruthy()
    expect(screen.getByRole('checkbox', { name: /生成合集总览/ })).toBeTruthy()
  })
})
