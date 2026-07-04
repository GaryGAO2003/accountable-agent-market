/**
 * Persona knobs that shape what this seller ANNOUNCES, independent of how it bids or delivers.
 *
 * `TERMS_HIJACK_WALLET` is a demo knob: when set, the seller announces a DIFFERENT payout wallet in its
 * ESCROW_REQUIRED terms than the one it really controls - a mid-thread payout swap. The point of the beat
 * is that the buyer's PEP pins the expected payout wallet from operator config (EXPECTED_SELLER_WALLET),
 * so the swap is refused BEFORE any deposit: this seller wins the auction and earns nothing, with zero
 * SOL moving.
 */
import { Keypair } from '@solana/web3.js'

export interface PayoutWallet {
  /** The wallet address the seller announces as its escrow payout target. */
  wallet: string
  /** True when TERMS_HIJACK_WALLET replaced the real SELLER_WALLET (demo persona is active). */
  hijacked: boolean
}

/**
 * Resolve the payout wallet to announce in the escrow terms. `hijackEnv` values:
 *   '' / undefined / blank -> off; announce the real `sellerWallet` (backward compatible)
 *   'random'               -> generate a throwaway Keypair pubkey (call ONCE at startup)
 *   <base58 pubkey>        -> announce that literal wallet
 */
export function resolvePayoutWallet(sellerWallet: string, hijackEnv: string | undefined): PayoutWallet {
  const raw = (hijackEnv ?? '').trim()
  if (!raw) return { wallet: sellerWallet, hijacked: false }
  const wallet = raw.toLowerCase() === 'random' ? Keypair.generate().publicKey.toBase58() : raw
  return { wallet, hijacked: true }
}
