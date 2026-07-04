import { describe, it, expect } from 'vitest'
import { Keypair } from '@solana/web3.js'
import { buildMemoIx, MEMO_PROGRAM_ID, sendMemo } from './memo.js'

describe('buildMemoIx', () => {
  const payer = Keypair.generate().publicKey

  it('targets the SPL Memo program', () => {
    expect(buildMemoIx(payer, 'hello').programId.equals(MEMO_PROGRAM_ID)).toBe(true)
  })

  it('names the payer as the lone signer (authorship), read-only', () => {
    const ix = buildMemoIx(payer, 'REPUTATION seller=s score=2 tier=trusted outcome=settled round=1')
    expect(ix.keys).toHaveLength(1)
    expect(ix.keys[0].pubkey.equals(payer)).toBe(true)
    expect(ix.keys[0].isSigner).toBe(true)
    expect(ix.keys[0].isWritable).toBe(false)
  })

  it('encodes the text as utf-8 data that decodes back verbatim (multi-byte preserved)', () => {
    const text = 'REPUTATION seller=Ünïcodè score=-3 tier=flagged outcome=refunded round=9'
    const ix = buildMemoIx(payer, text)
    expect(Buffer.from(ix.data).toString('utf8')).toBe(text)
    expect(ix.data.length).toBe(Buffer.byteLength(text, 'utf8'))
  })

  // No network calls here: sendMemo's send path is not exercised (it needs a funded devnet wallet).
  it('sendMemo is exposed as an async sender', () => {
    expect(typeof sendMemo).toBe('function')
  })
})
