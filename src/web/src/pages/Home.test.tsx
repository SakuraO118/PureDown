import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import Home from './Home'

describe('toolbox home', () => {
  it('offers independent download and summary tools', () => {
    render(<MemoryRouter><Home /></MemoryRouter>)
    expect(screen.getByRole('link', { name: /视频下载/ }).getAttribute('href')).toBe('/download')
    expect(screen.getByRole('link', { name: /视频总结/ }).getAttribute('href')).toBe('/summarize')
  })
})
