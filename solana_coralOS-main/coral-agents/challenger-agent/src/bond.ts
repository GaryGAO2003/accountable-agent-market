import type { Keypair } from '@solana/web3.js'
import { loadKeypairB58, signTransfer } from '@pay/agent-runtime'

export interface ChallengeBondOptions {
  holderWallet: string
  amountSol: number
  maxSol?: number
  keypair?: Keypair
}

type TransferFn = typeof signTransfer

export async function postChallengeBond(
  opts: ChallengeBondOptions,
  transfer: TransferFn = signTransfer,
): Promise<string | undefined> {
  if (opts.amountSol <= 0) return undefined
  if (!opts.holderWallet) throw new Error('BOND_HOLDER_WALLET not set')
  const challenger = opts.keypair ?? loadKeypairB58('CHALLENGER_KEYPAIR_B58')
  return transfer(challenger, opts.holderWallet, opts.amountSol, { maxSol: opts.maxSol })
}
