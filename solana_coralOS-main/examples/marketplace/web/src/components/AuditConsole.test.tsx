import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { AuditConsole } from './AuditConsole'
import { fixtureRounds } from '../../tests/fixtures'

afterEach(cleanup)

describe('AuditConsole', () => {
  it('streams ALLOW and DENY decisions from folded rounds', () => {
    render(<AuditConsole rounds={fixtureRounds} />)
    const consoleEl = screen.getByTestId('audit-console')
    expect(consoleEl.textContent).toContain('ALLOW')
    expect(consoleEl.textContent).toContain('DENY')
    expect(consoleEl.textContent).toContain('RECIPIENT_NOT_ALLOWED')
    expect(consoleEl.textContent).toContain('round 4')
  })

  it('has an empty state before the buyer streams audit lines', () => {
    render(<AuditConsole rounds={[]} />)
    expect(screen.getByTestId('audit-empty').textContent).toContain('Waiting for EGRESS_AUDIT')
  })
})
