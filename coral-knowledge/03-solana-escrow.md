# 03 — Solana: Settlement & The Escrow Contract

> **Solana moves money.** Sub-second finality, fees of a fraction of a cent → machine
> micropayments ($0.0001/call) become real. Software can be a paying customer.
> Everything runs on **devnet** (free play-money, identical to mainnet, zero risk).

## Solana Pay (the payment request)

- Payments in the kit are plain `SystemProgram.transfer` of **SOL**, requested via
  **Solana Pay** with a **reference key**, then verified on-chain.
- `generatePaymentUrl()` mints a `solana:` request URL (`encodeURL`) carrying the
  **recipient**, **amount**, and a **fresh, single-use reference** — a throwaway pubkey
  unique to that one order. The reference is what **binds a payment to one order**.

## Keys & Funding

You bring your own **devnet** keys — none ship in the repo. Two are generated; one you
already have (Phantom for the human checkout).

### Funding is web-only
All devnet SOL comes from the **faucet website** (sign in with GitHub):
> **https://faucet.solana.com**

CLI and RPC airdrops are rate-gated and will fail. Fund **every** wallet.

### Generate the keys (one command)
```sh
node scripts/setup.js
```
Generates a seller wallet + a buyer wallet, writes them to `.env`, prints both addresses to
fund (also saved to `WALLETS.txt`). **Re-running is safe** — it re-reads existing keys
instead of overwriting.

### Where each key goes
```sh
# .env
WALLET=<seller public key>            # Seller RECEIVES → public key only
BUYER_KEYPAIR_B58=<buyer secret, b58> # Buyer SIGNS → full secret key, base58
```

| Agent | Key it needs | `.env` var | Fund? |
|-------|-------------|-----------|-------|
| **Seller** | public address | `WALLET=` | ✅ at faucet |
| **Buyer** | secret key (base58) | `BUYER_KEYPAIR_B58=` | ✅ at faucet |
| **Human (Checkout)** | your own Phantom wallet | — (signs in browser) | ✅ set Phantom to **Devnet**, fund separately |

> ⚠️ `BUYER_KEYPAIR_B58` is a **private key** — `.env` is gitignored. Never commit it.
> Never put a funded **mainnet** key in `.env` (`setRpc` rejects mainnet unless `ALLOW_MAINNET=1`).

## The escrow contract — agents that TRANSACT, not just talk

Most agent frameworks stop at messaging. This one lets agents **transact** trustlessly via a
Solana program: an **escrow contract** that holds funds while agents work, releasing only on
delivery. Coordination = CoralOS; settlement = on-chain, in a box neither party can cheat.

### The primitive — three calls
The buyer **locks** funds in a per-order escrow; the seller verifies they're locked
**before** working; the buyer **releases** on delivery (or **refunds** after a deadline).

```ts
// Buyer side — coral-agents/buyer-agent/src/escrow.ts
const program = await makeProgram(buyer, RPC)
const depositSig = await deposit(program, buyer, seller, reference, amountSol, /* deadline */ 600)  // 🔒 lock
// …seller delivers…
const releaseSig = await release(program, buyer, seller, reference)   // 💸 pay on delivery
// …or, if nothing arrives by the deadline:
await refund(program, buyer, reference)                              // ↩ reclaim

// Seller side — coral-agents/seller-agent/src/escrow.ts
if (await isFunded(program, buyerPk, myWallet, reference, amountSol)) {
  await ctx.reply(mention, `DELIVERED ${await deliverService(req)}`)  // only deliver against locked funds
}
```

> The `reference` that seeds the escrow **PDA is the same key** the order is bound to — so the
> agent protocol and the contract interlock with no new identifier.
> `seeds = [b"escrow", buyer, reference]` → **one box per `(buyer, order)`**: no shared
> "master" box, no replay.

### The lifecycle
```
buyer   deposit(seller, reference, amount, deadline)   🔒 funds locked in PDA(buyer, reference)
seller  isFunded(buyer, seller, reference) ✓           reads the chain before doing the work
seller  deliver → DELIVERED
buyer   release(seller, reference)                     💸 seller paid, box closed (rent → buyer)
   …or, no delivery by the deadline…
buyer   refund(reference)                              ↩ funds returned
```
**Neither side can cheat:** the seller can't take funds without a `release`; the buyer can't
claw back after releasing, and is protected by the deadline if the seller ghosts.

### The shipped program — 3 instructions
`escrow/programs/escrow/src/lib.rs` (the **only Rust** in the kit):
```rust
pub fn initialize(ctx, amount: u64, reference: Pubkey, deadline: i64) -> Result<()>  // buyer deposits
pub fn release(ctx) -> Result<()>                                                     // buyer pays seller
pub fn refund(ctx) -> Result<()>                                                      // buyer reclaims past deadline
// Escrow { buyer, seller, amount, reference, deadline, bump }
```

## What the contract unlocks

| Build | What the agents do | Contract bits |
|-------|-------------------|---------------|
| **Trustless marketplace** | LLM sellers compete; winner paid only on delivery | `deposit` / `release` (shipped) |
| **Dispute resolution** | an **arbiter agent** adjudicates a contested delivery | add an `arbitrate` instruction ↓ |
| **Milestone / streaming** | partial releases as a long job progresses | multiple releases on sub-orders |
| **Subscriptions** | a recurring escrow the seller claims per period | a `claim` instruction + period check |
| **Reputation** | a PDA per agent; buyers check it before escrowing | a second account/program |
| **Staking + slashing** | sellers stake; bad delivery slashes the stake | arbiter + a stake account |

## The arbiter upgrade (trustless three-party)

Two parties means the buyer is judge of its own delivery. To make it **trustless three-party**,
bind an **arbiter** at `initialize` and let it break ties:

```rust
// in Escrow:  pub arbiter: Pubkey,        // set during initialize

pub fn arbitrate(ctx: Context<Arbitrate>, pay_seller: bool) -> Result<()> {
    let amt = ctx.accounts.escrow.amount;
    let dst = if pay_seller { &ctx.accounts.seller } else { &ctx.accounts.buyer };
    **ctx.accounts.escrow.to_account_info().try_borrow_mut_lamports()? -= amt;
    **dst.try_borrow_mut_lamports()? += amt;
    Ok(()) // `close = buyer` returns the rent
}

#[derive(Accounts)]
pub struct Arbitrate<'info> {
    pub arbiter: Signer<'info>,                                   // only the bound arbiter may call
    #[account(mut, close = buyer, has_one = arbiter, has_one = buyer, has_one = seller)]
    pub escrow: Account<'info, Escrow>,
    /// CHECK: payout targets, validated by has_one
    #[account(mut)] pub buyer: UncheckedAccount<'info>,
    #[account(mut)] pub seller: UncheckedAccount<'info>,
}
```

> Tooling note: the **`solana-dev` skill** scaffolds the Anchor change + **LiteSVM tests**.

### The headline agent
An **LLM arbiter agent** = a 4th participant in the CoralOS session that reads a disputed
delivery, decides who's right, and calls `arbitrate(pay_seller)`. A reputation-staked judge
made of code. **The economy stops needing anyone to be trusted:**
- Agents coordinate (CoralOS) → funds escrowed (contract) → an agent reasons about the
  dispute (LLM) → the contract enforces the verdict (on-chain).
