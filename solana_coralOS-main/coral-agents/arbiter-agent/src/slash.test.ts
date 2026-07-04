import { Keypair } from '@solana/web3.js'
import { describe, expect, it } from 'vitest'
import { slashSellerBond } from './slash.js'

describe('slashSellerBond', () => {
  it('moves a posted bond from the arbiter holder to the challenger', async () => {
    const arbiter = Keypair.generate()
    const to = Keypair.generate().publicKey.toBase58()
    const slash = await slashSellerBond({
      round: 9,
      arbiter,
      to,
      amountSol: 0.0001,
    }, async (_keypair, recipient, amount, opts) => {
      expect(recipient).toBe(to)
      expect(amount).toBe(0.0001)
      expect(opts?.maxSol).toBe(0.0001)
      return 'SlashSig111'
    })

    expect(slash).toEqual({
      round: 9,
      sig: 'SlashSig111',
      amountSol: 0.0001,
      from: arbiter.publicKey.toBase58(),
      to,
      bond: 'seller',
      settlement: 'transfer',
      arbiter: true,
    })
  })
})
