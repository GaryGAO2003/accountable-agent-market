import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { FlowView } from './FlowView'

afterEach(cleanup)

// jsdom has no matchMedia, which FlowView treats as prefers-reduced-motion — every
// scenario settles instantly, so these tests read final states without fake timers.
describe('FlowView', () => {
  it('renders the three scenarios, the vault, and the punchline', () => {
    render(<FlowView />)
    expect(screen.getByTestId('flow-scn-honest')).toBeTruthy()
    expect(screen.getByTestId('flow-scn-ghost')).toBeTruthy()
    expect(screen.getByTestId('flow-scn-fraud')).toBeTruthy()
    expect(screen.getByTestId('flow-vault').textContent).toContain('Escrow vault')
    expect(screen.getByText(/Cheating costs the cheater/)).toBeTruthy()
  })

  it('ghost scenario refunds: money back to the buyer, REFUNDED receipt, verdict shown', () => {
    render(<FlowView />)
    fireEvent.click(screen.getByTestId('flow-scn-ghost'))
    expect(screen.getByTestId('flow-log').textContent).toContain('REFUNDED')
    expect(screen.getByTestId('flow-log').textContent).toContain('taking the escrow hostage')
    expect(screen.getByTestId('flow-verdict-back').className).toContain('show')
    expect(screen.getByTestId('flow-bal-buyer').textContent).toBe('1.00000')
    expect(screen.getByTestId('flow-bal-vault').textContent).toBe('0.00000')
    expect(screen.getByText('won the auction — earned nothing')).toBeTruthy()
  })

  it('honest scenario releases: seller paid, RELEASED receipt with a devnet link', () => {
    render(<FlowView />)
    fireEvent.click(screen.getByTestId('flow-scn-honest'))
    expect(screen.getByTestId('flow-log').textContent).toContain('RELEASED')
    expect(screen.getByTestId('flow-verdict-paid').className).toContain('show')
    expect(screen.getByTestId('flow-bal-seller').textContent).toBe('2.43180')
    const link = screen.getByRole('link', { name: /RELEASED/ }) as HTMLAnchorElement
    expect(link.href).toContain('cluster=devnet')
  })

  it('fraud scenario blocks release: verification mismatch then refund path', () => {
    render(<FlowView />)
    fireEvent.click(screen.getByTestId('flow-scn-fraud'))
    expect(screen.getByTestId('flow-log').textContent).toContain('VERIFICATION_FAILED')
    expect(screen.getByTestId('flow-verdict-back').className).toContain('show')
  })
})
