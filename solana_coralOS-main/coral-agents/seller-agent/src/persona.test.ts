import { describe, expect, it } from 'vitest'
import { Keypair, PublicKey } from '@solana/web3.js'
import { formatEscrowRequired, parseEscrowRequired } from '@pay/agent-runtime'
import { resolvePayoutWallet } from './persona.js'

const REAL = Keypair.generate().publicKey.toBase58()
const HIJACK = Keypair.generate().publicKey.toBase58()

/** Build the ESCROW_REQUIRED terms exactly as index.ts does and read back the announced payout wallet. */
function announcedSeller(hijackEnv: string | undefined): string {
  const { wallet } = resolvePayoutWallet(REAL, hijackEnv)
  const terms = formatEscrowRequired({
    round: 1, reference: 'ref', seller: wallet, amountSol: 0.00028, deadlineSecs: 45, settlement: 'arbiter',
  })
  return parseEscrowRequired(terms)!.seller
}

describe('TERMS_HIJACK_WALLET payout swap', () => {
  it('announces the hijack wallet in the escrow terms when set to a pubkey', () => {
    const { wallet, hijacked } = resolvePayoutWallet(REAL, HIJACK)
    expect(hijacked).toBe(true)
    expect(wallet).toBe(HIJACK)
    // The mid-thread swap: the announced payout wallet is the hijack wallet, NOT SELLER_WALLET.
    expect(announcedSeller(HIJACK)).toBe(HIJACK)
    expect(announcedSeller(HIJACK)).not.toBe(REAL)
  })

  it('falls back to SELLER_WALLET when unset (backward compatible)', () => {
    for (const off of ['', undefined, '   '] as (string | undefined)[]) {
      const { wallet, hijacked } = resolvePayoutWallet(REAL, off)
      expect(hijacked).toBe(false)
      expect(wallet).toBe(REAL)
      expect(announcedSeller(off)).toBe(REAL)
    }
  })

  it("generates a throwaway wallet for the literal 'random'", () => {
    const { wallet, hijacked } = resolvePayoutWallet(REAL, 'random')
    expect(hijacked).toBe(true)
    expect(wallet).not.toBe(REAL)
    // A valid base58 Solana pubkey that the buyer would see (and its PEP would refuse).
    expect(() => new PublicKey(wallet)).not.toThrow()
    // ...and it flows through into the announced terms as a non-real payout wallet.
    const announced = announcedSeller('random')
    expect(announced).not.toBe(REAL)
    expect(() => new PublicKey(announced)).not.toThrow()
  })
})
