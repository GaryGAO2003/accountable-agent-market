import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import { RoundCard } from './RoundCard'
import { settledRound, refundedRound, slashedRound } from '../../tests/fixtures'

afterEach(cleanup)

describe('RoundCard', () => {
  it('renders the want, both bids, and the declined seller', () => {
    render(<RoundCard round={settledRound} />)
    expect(screen.getByTestId('round').getAttribute('data-round')).toBe('1')
    expect(screen.getAllByTestId('bid')).toHaveLength(2)
    expect(screen.getByTestId('declined').getAttribute('data-seller')).toBe('seller-honest')
  })

  it('highlights the winning bid with a "won" tag', () => {
    render(<RoundCard round={settledRound} />)
    const winner = screen.getAllByTestId('bid').find((el) => el.getAttribute('data-seller') === 'seller-premium')!
    expect(winner.className).toContain('bid-won')
    expect(within(winner).getByText('won')).toBeTruthy()
  })

  it('shows the LLM award reasoning', () => {
    render(<RoundCard round={settledRound} />)
    expect(screen.getByTestId('reason').textContent).toContain('verified data worth the premium')
  })

  it('links deposit + release to the devnet Explorer with the right sigs', () => {
    render(<RoundCard round={settledRound} />)
    const links = screen.getAllByTestId('settle') as HTMLAnchorElement[]
    expect(links).toHaveLength(2)
    expect(links.some((a) => a.href.includes('3PMa9LBZn7VEMD1qZnmr') && a.href.includes('cluster=devnet'))).toBe(true)
  })

  it('shows objective verification before release', () => {
    render(<RoundCard round={settledRound} />)
    expect(screen.getByTestId('verification').textContent).toContain('Verified: re-exec matched')
  })

  it('shows the status pill as settled', () => {
    render(<RoundCard round={settledRound} />)
    expect(screen.getByTestId('status').textContent).toBe('settled')
  })

  it('shows the status pill as refunded when the buyer reclaims escrow', () => {
    render(<RoundCard round={refundedRound} />)
    expect(screen.getByTestId('status').textContent).toBe('refunded')
  })

  it('links the refund to the devnet Explorer with the reclaim sig', () => {
    render(<RoundCard round={refundedRound} />)
    const refund = screen.getByRole('link', { name: /refund/i }) as HTMLAnchorElement
    expect(refund.href).toContain(refundedRound.refund!.sig)
    expect(refund.href).toContain('cluster=devnet')
  })

  it('shows L1 challenge and slash evidence', () => {
    render(<RoundCard round={slashedRound} />)
    expect(screen.getByTestId('status').textContent).toBe('slashed')
    expect(screen.getByTestId('accountability').textContent).toContain('challenge upheld')
    const slash = screen.getByRole('link', { name: /slash/i }) as HTMLAnchorElement
    expect(slash.href).toContain(slashedRound.slash!.sig)
    expect(slash.href).toContain('cluster=devnet')
  })
})
