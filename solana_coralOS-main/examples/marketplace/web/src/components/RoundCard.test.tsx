import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import { RoundCard } from './RoundCard'
import { settledRound, refundedRound, blockedRound, repFlagRound, frozenBidRound } from '../../tests/fixtures'

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

  it('shows a violet PEP-blocked badge with the reason code for a blocked round', () => {
    render(<RoundCard round={blockedRound} />)
    expect(screen.getByTestId('status').textContent).toBe('blocked')
    const blocked = screen.getByTestId('blocked')
    expect(blocked.textContent).toContain('PEP blocked')
    expect(blocked.textContent).toContain('RECIPIENT_NOT_ALLOWED')
    expect(blocked.textContent).toContain('no funds moved')
  })

  it('renders no Explorer link or settlement badge for a blocked round (nothing settled on-chain)', () => {
    render(<RoundCard round={blockedRound} />)
    expect(screen.queryByTestId('settle')).toBeNull()
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('renders the L3 reputation line with a memo link attributed to reputation, not settlement', () => {
    render(<RoundCard round={frozenBidRound} />)
    const line = screen.getByTestId('reputation')
    expect(line.textContent).toContain('seller-honest')
    expect(line.textContent).toContain('trusted')
    expect(line.textContent).toContain('score 2')
    // the memo link lives INSIDE the reputation line, points at the memo tx (not the settlement sigs), and is devnet
    const memo = within(line).getByTestId('rep-memo') as HTMLAnchorElement
    expect(memo.href).toContain('cluster=devnet')
    expect(memo.href).toContain(frozenBidRound.reputation!.sig!)
    expect(memo.getAttribute('data-testid')).not.toBe('settle') // distinct from a settlement badge
  })

  it('renders the reputation line without a memo link when the standing change carries no sig', () => {
    render(<RoundCard round={{ ...settledRound, reputation: { seller: 'seller-premium', score: 2, tier: 'trusted', outcome: 'settled' } }} />)
    expect(screen.getByTestId('reputation').textContent).toContain('trusted')
    expect(screen.queryByTestId('rep-memo')).toBeNull()
  })

  it('stamps a "frozen out" chip on a flagged bid and a "✓ trusted" chip on a trusted bid', () => {
    render(<RoundCard round={frozenBidRound} />)
    const flagged = screen.getAllByTestId('bid').find((el) => el.getAttribute('data-seller') === 'seller-rogue')!
    const trusted = screen.getAllByTestId('bid').find((el) => el.getAttribute('data-seller') === 'seller-honest')!
    expect(within(flagged).getByText('frozen out')).toBeTruthy()
    expect(within(trusted).getByText('✓ trusted')).toBeTruthy()
  })

  it('renders no reputation chip on a neutral bid', () => {
    render(<RoundCard round={settledRound} />)
    expect(screen.queryByTestId('rep-chip')).toBeNull()
  })

  it('links the reputation memo to the devnet Explorer on a refunded round (memo ≠ the refund tx)', () => {
    render(<RoundCard round={repFlagRound} />)
    const memo = within(screen.getByTestId('reputation')).getByTestId('rep-memo') as HTMLAnchorElement
    expect(memo.href).toContain(repFlagRound.reputation!.sig!)
    expect(memo.href).not.toContain(repFlagRound.refund!.sig) // the memo trail is a different tx from settlement
  })
})
