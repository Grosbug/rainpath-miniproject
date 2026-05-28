import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import WorkflowsList from './index'

const originalFetch = globalThis.fetch

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/workflows']}>
        <WorkflowsList />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

function mockFetch(status: number, body: unknown) {
  globalThis.fetch = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  ) as unknown as typeof fetch
}

describe('WorkflowsList', () => {
  beforeEach(() => { globalThis.fetch = originalFetch })

  it('renders the empty state when the list is empty', async () => {
    mockFetch(200, [])
    renderPage()
    expect(await screen.findByText(/Aucun workflow/i)).toBeInTheDocument()
  })

  it('renders a row per workflow', async () => {
    mockFetch(200, [
      { id: 'w1', name: 'Relance standard', description: 'desc', updatedAt: new Date().toISOString() },
      { id: 'w2', name: 'Suivi rapide', description: null, updatedAt: new Date().toISOString() }
    ])
    renderPage()
    expect(await screen.findByText('Relance standard')).toBeInTheDocument()
    expect(screen.getByText('Suivi rapide')).toBeInTheDocument()
  })

  it('renders the error state on API failure', async () => {
    mockFetch(500, { message: 'boom' })
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/Impossible de charger/i)).toBeInTheDocument()
    })
  })
})
