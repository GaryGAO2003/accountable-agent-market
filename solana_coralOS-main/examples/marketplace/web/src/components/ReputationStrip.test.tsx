import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import { ReputationStrip } from './ReputationStrip'
import { reputationSummaryFixture } from '../../tests/fixtures'

afterEach(cleanup)

describe('ReputationStrip', () => {
  it('renders one row per seller with its tier chip and score', () => {
    render(<ReputationStrip reputation={reputationSummaryFixture} />)
    expect(screen.getByTestId('rep-strip')).toBeTruthy()
    expect(screen.getAllByTestId('rep-seller')).toHaveLength(3)

    const rogue = screen.getAllByTestId('rep-seller').find((el) => el.getAttribute('data-seller') === 'seller-rogue')!
    expect(within(rogue).getByTestId('rep-tier').textContent).toBe('flagged')
    expect(rogue.textContent).toContain('score -3')

    const honest = screen.getAllByTestId('rep-seller').find((el) => el.getAttribute('data-seller') === 'seller-honest')!
    expect(within(honest).getByTestId('rep-tier').textContent).toBe('trusted')
  })

  it('renders nothing when there is no reputation yet', () => {
    const { container } = render(<ReputationStrip reputation={undefined} />)
    expect(container.firstChild).toBeNull()
    expect(screen.queryByTestId('rep-strip')).toBeNull()
  })
})
