import { Keypair } from '@solana/web3.js'
import { describe, expect, it } from 'vitest'
import { postSellerBond } from './bond.js'

describe('postSellerBond', () => {
  it('posts a transfer-backed seller bond to the holder wallet', async () => {
    const seller = Keypair.generate()
    const bond = await postSellerBond({
      round: 7,
      sellerWallet: seller.publicKey.toBase58(),
      holderWallet: Keypair.generate().publicKey.toBase58(),
      amountSol: 0.0001,
      maxSol: 0.001,
      keypair: seller,
    }, async (_keypair, _recipient, _amount, opts) => {
      expect(opts?.maxSol).toBe(0.001)
      return 'BondSig111'
    })

    expect(bond).toMatchObject({
      round: 7,
      seller: seller.publicKey.toBase58(),
      amountSol: 0.0001,
      sig: 'BondSig111',
    })
  })

  it('allows bond posting to be disabled for non-L1 local tests', async () => {
    await expect(postSellerBond({
      round: 1,
      sellerWallet: 'seller',
      holderWallet: '',
      amountSol: 0,
    })).resolves.toBeNull()
  })
})
