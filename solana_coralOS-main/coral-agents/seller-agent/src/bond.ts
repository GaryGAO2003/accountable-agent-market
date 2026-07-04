import type { Keypair } from '@solana/web3.js'
import { loadKeypairB58, signTransfer, type BondPosted } from '@pay/agent-runtime'

export interface SellerBondOptions {
  round: number
  sellerWallet: string
  holderWallet: string
  amountSol: number
  maxSol?: number
  keypair?: Keypair
}

type TransferFn = typeof signTransfer

export async function postSellerBond(
  opts: SellerBondOptions,
  transfer: TransferFn = signTransfer,
): Promise<BondPosted | null> {
  if (opts.amountSol <= 0) return null
  if (!opts.holderWallet) throw new Error('BOND_HOLDER_WALLET not set')
  const seller = opts.keypair ?? loadKeypairB58('SELLER_KEYPAIR_B58')
  const sig = await transfer(seller, opts.holderWallet, opts.amountSol, { maxSol: opts.maxSol })
  return {
    round: opts.round,
    seller: opts.sellerWallet,
    holder: opts.holderWallet,
    amountSol: opts.amountSol,
    sig,
  }
}
