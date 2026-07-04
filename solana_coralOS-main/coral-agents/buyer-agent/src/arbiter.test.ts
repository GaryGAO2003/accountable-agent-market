import { describe, expect, it } from 'vitest'
import { PublicKey } from '@solana/web3.js'
import { assertConfiguredArbiter, decodeConfiguredArbiter } from './arbiter.js'

const localArbiter = new PublicKey('45L93oJJ6JEr3mw1osLqjXEJmHeVdXQ4CQauSaEnFBJH')
const deployedArbiter = new PublicKey('Ay2GqHyukwso14RLZWRPhnFMovGGPpVcBzZcnceEiG4Z')

describe('arbiter config preflight', () => {
  it('decodes the configured arbiter from the Anchor account body', () => {
    const data = Buffer.concat([Buffer.alloc(8), deployedArbiter.toBuffer(), Buffer.from([255])])

    expect(decodeConfiguredArbiter(data)?.toBase58()).toBe(deployedArbiter.toBase58())
  })

  it('fails early when the deployed program is locked to another arbiter', () => {
    expect(() => assertConfiguredArbiter(localArbiter, deployedArbiter)).toThrow(/NotArbiter/)
    expect(() => assertConfiguredArbiter(localArbiter, deployedArbiter)).toThrow(deployedArbiter.toBase58())
    expect(() => assertConfiguredArbiter(localArbiter, deployedArbiter)).toThrow(localArbiter.toBase58())
  })

  it('allows an uninitialized or matching config', () => {
    expect(() => assertConfiguredArbiter(localArbiter, null)).not.toThrow()
    expect(() => assertConfiguredArbiter(localArbiter, localArbiter)).not.toThrow()
  })
})
