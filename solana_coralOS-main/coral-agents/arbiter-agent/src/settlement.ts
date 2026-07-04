import anchor from '@coral-xyz/anchor'
import type { Idl, Program } from '@coral-xyz/anchor'
import { Keypair, PublicKey, SystemProgram } from '@solana/web3.js'
import { solanaConnection } from '@pay/agent-runtime'

const { AnchorProvider } = anchor

export const ESCROW_PROGRAM_ID = new PublicKey('R5NWNg9eRLWWQU81Xbzz5Du1k7jTDeeT92Ty6qCeXet')
export const DEFAULT_ARBITER_PROGRAM_ID = 'FJtuVXsyXuRKqgJBEPAXmktkd13CqStapgevzGwYktXd'
export const ARBITER_PROGRAM_ID = new PublicKey(process.env.ARBITER_PROGRAM_ID ?? DEFAULT_ARBITER_PROGRAM_ID)

const ARBITER_IDL = {
  address: ARBITER_PROGRAM_ID.toBase58(),
  metadata: { name: 'arbiter', version: '0.1.0', spec: '0.1.0' },
  instructions: [
    {
      name: 'arbitrate_release',
      discriminator: [194, 41, 251, 189, 16, 195, 150, 11],
      accounts: [
        { name: 'arbiter', signer: true },
        { name: 'config' },
        { name: 'vault', writable: true },
        { name: 'seller', writable: true },
        { name: 'escrow', writable: true },
        { name: 'escrow_program', address: ESCROW_PROGRAM_ID.toBase58() },
      ],
      args: [{ name: 'reference', type: 'pubkey' }],
    },
    {
      name: 'arbitrate_refund',
      discriminator: [4, 224, 236, 160, 245, 77, 252, 172],
      accounts: [
        { name: 'arbiter', signer: true },
        { name: 'config' },
        { name: 'vault', writable: true },
        { name: 'payer', writable: true },
        { name: 'escrow', writable: true },
        { name: 'escrow_program', address: ESCROW_PROGRAM_ID.toBase58() },
        { name: 'system_program', address: SystemProgram.programId.toBase58() },
      ],
      args: [{ name: 'reference', type: 'pubkey' }],
    },
  ],
} as Idl

export const configPda = (): PublicKey =>
  PublicKey.findProgramAddressSync([Buffer.from('config')], ARBITER_PROGRAM_ID)[0]

export const vaultPda = (reference: PublicKey): PublicKey =>
  PublicKey.findProgramAddressSync([Buffer.from('vault'), reference.toBuffer()], ARBITER_PROGRAM_ID)[0]

export const arbitratedEscrowPda = (vault: PublicKey, reference: PublicKey): PublicKey =>
  PublicKey.findProgramAddressSync(
    [Buffer.from('escrow'), vault.toBuffer(), reference.toBuffer()],
    ESCROW_PROGRAM_ID,
  )[0]

export function decodeConfiguredArbiter(data: Uint8Array): PublicKey | null {
  if (data.length < 8 + 32) return null
  return new PublicKey(data.slice(8, 8 + 32))
}

export function assertConfiguredArbiter(expected: PublicKey, configured: PublicKey | null): void {
  if (!configured || configured.equals(expected)) return
  throw new Error(
    `Arbiter program ${ARBITER_PROGRAM_ID.toBase58()} is configured for arbiter ` +
    `${configured.toBase58()}, but ARBITER_KEYPAIR_B58 is ${expected.toBase58()}. ` +
    'Set ARBITER_PROGRAM_ID to a deployment initialized with this arbiter key, or use the configured arbiter key. ' +
    'Otherwise ARBITER_RELEASED will fail with NotArbiter.',
  )
}

export async function getConfiguredArbiter(rpcUrl: string): Promise<PublicKey | null> {
  const config = await solanaConnection(rpcUrl).getAccountInfo(configPda(), 'confirmed')
  return config ? decodeConfiguredArbiter(config.data) : null
}

export function makeArbiter(signer: Keypair, rpcUrl: string): Program {
  const provider = new AnchorProvider(solanaConnection(rpcUrl), new anchor.Wallet(signer), { commitment: 'confirmed' })
  return new anchor.Program(ARBITER_IDL, provider)
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function arbitrateRelease(
  program: Program,
  arbiter: Keypair,
  seller: PublicKey,
  reference: PublicKey,
): Promise<string> {
  const vault = vaultPda(reference)
  const escrow = arbitratedEscrowPda(vault, reference)
  return (program.methods as any)
    .arbitrateRelease(reference)
    .accounts({ arbiter: arbiter.publicKey, config: configPda(), vault, seller, escrow, escrowProgram: ESCROW_PROGRAM_ID })
    .signers([arbiter])
    .rpc()
}

export async function arbitrateRefund(
  program: Program,
  arbiter: Keypair,
  payer: PublicKey,
  reference: PublicKey,
): Promise<string> {
  const vault = vaultPda(reference)
  const escrow = arbitratedEscrowPda(vault, reference)
  return (program.methods as any)
    .arbitrateRefund(reference)
    .accounts({
      arbiter: arbiter.publicKey,
      config: configPda(),
      vault,
      payer,
      escrow,
      escrowProgram: ESCROW_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .signers([arbiter])
    .rpc()
}
