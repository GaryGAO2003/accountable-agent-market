/**
 * On-chain reputation trail via the SPL Memo program.
 *
 * This is honestly a **log, not a state machine**: it appends one human-/machine-readable line to the
 * chain and nothing more. The authority over standing lives in the reputation *ledger*
 * (`market/reputation.ts`), which derives tiers from outcomes; a memo just anchors one of those outcome
 * lines to a real, signed, timestamped transaction, so the trail is publicly auditable and can't be
 * quietly rewritten after the fact. We ride the **SPL Memo** program precisely so there is *no custom
 * program to deploy* - it is already present on every cluster.
 *
 * The payer is the memo's lone signer: signing *is* the claim of authorship ("this wallet wrote this
 * line"), which is the only integrity guarantee a bare log needs. A memo never moves value - settlement
 * still goes through `pay.ts` and the escrow.
 *
 * Mirrors `pay.ts`: a pure instruction builder plus a thin sender over the devnet-guarded connection.
 */
import {
  PublicKey,
  TransactionInstruction,
  Transaction,
  Keypair,
  sendAndConfirmTransaction,
} from '@solana/web3.js'
import { solanaConnection } from './connection.js'

/** SPL Memo v2 program id - deployed on every Solana cluster, so nothing of ours needs building or deploying. */
export const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr')

/**
 * Build a memo instruction carrying `text`, attributed to `payer`.
 *
 * Pure (no connection, no signing) so it can be unit-tested and composed into a larger transaction. The
 * Memo program treats the instruction data as opaque UTF-8 and simply logs it; listing `payer` as a
 * (read-only) signer is what binds the line to an identity - the runtime verifies the signature, so a log
 * entry can't be forged in someone else's name.
 */
export function buildMemoIx(payer: PublicKey, text: string): TransactionInstruction {
  return new TransactionInstruction({
    keys: [{ pubkey: payer, isSigner: true, isWritable: false }],
    programId: MEMO_PROGRAM_ID,
    data: Buffer.from(text, 'utf8'),
  })
}

/**
 * Write `text` to the chain as a memo signed by `keypair`, returning the confirmed signature.
 *
 * Deliberately minimal - build ix -> Transaction -> send with `confirmed` commitment. No retries, no
 * fallback, no budget check: callers own that policy (as they do around `pay.ts`), so this stays a thin,
 * predictable primitive. Goes through `solanaConnection()` so the devnet guard covers the log trail
 * exactly as it covers settlement.
 */
export async function sendMemo(keypair: Keypair, text: string): Promise<string> {
  const tx = new Transaction().add(buildMemoIx(keypair.publicKey, text))
  return sendAndConfirmTransaction(solanaConnection(), tx, [keypair], { commitment: 'confirmed' })
}
