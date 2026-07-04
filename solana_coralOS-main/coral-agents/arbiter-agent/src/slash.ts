import type { Keypair } from '@solana/web3.js'
import { signTransfer, type Slash } from '@pay/agent-runtime'

type TransferFn = typeof signTransfer

export async function slashSellerBond(
  opts: { round: number; arbiter: Keypair; to: string; amountSol: number; bond?: 'seller' | 'challenger' },
  transfer: TransferFn = signTransfer,
): Promise<Slash | null> {
  if (opts.amountSol <= 0) return null
  const sig = await transfer(opts.arbiter, opts.to, opts.amountSol, { maxSol: opts.amountSol })
  return {
    round: opts.round,
    sig,
    amountSol: opts.amountSol,
    from: opts.arbiter.publicKey.toBase58(),
    to: opts.to,
    bond: opts.bond ?? 'seller',
    settlement: 'transfer',
    arbiter: true,
  }
}
