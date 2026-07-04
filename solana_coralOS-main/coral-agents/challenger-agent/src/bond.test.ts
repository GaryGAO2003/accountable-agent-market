import { Keypair } from '@solana/web3.js'
import { describe, expect, it } from 'vitest'
import { postChallengeBond } from './bond.js'

describe('postChallengeBond', () => {
  it('posts a transfer-backed challenger bond to the holder wallet', async () => {
    const challenger = Keypair.generate()
    const holder = Keypair.generate().publicKey.toBase58()

    const sig = await postChallengeBond({
      holderWallet: holder,
      amountSol: 0.0001,
      maxSol: 0.001,
      keypair: challenger,
    }, async (keypair, recipient, amount, opts) => {
      expect(keypair.publicKey.toBase58()).toBe(challenger.publicKey.toBase58())
      expect(recipient).toBe(holder)
      expect(amount).toBe(0.0001)
      expect(opts?.maxSol).toBe(0.001)
      return 'ChallengeBondSig111'
    })

    expect(sig).toBe('ChallengeBondSig111')
  })

  it('allows challenge bond posting to be disabled for local tests', async () => {
    await expect(postChallengeBond({
      holderWallet: '',
      amountSol: 0,
    })).resolves.toBeUndefined()
  })
})
