<!-- SOURCE: https://xforce-decentralised-protocols.gitbook.io/solanaxcoralos/solana-the-blockchain-for-the-agent-econonmy/agents-and-contracts -->

> For the complete documentation index, see [llms.txt](https://xforce-decentralised-protocols.gitbook.io/solanaxcoralos/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://xforce-decentralised-protocols.gitbook.io/solanaxcoralos/solana-the-blockchain-for-the-agent-econonmy/agents-and-contracts.md).

# Agents And Contracts

Most agent frameworks stop at messaging — agents *talk*. This one lets them **transact**. The bridge between agent coordination and trustless money is a Solana program: an **escrow contract** that holds funds while agents do their work, and releases them only on delivery. Coordination happens over CoralOS; settlement happens on-chain, in a box neither party can cheat.

### The primitive — three calls

An agent doesn't pay another agent directly. The buyer **locks** funds in a per-order escrow; the seller verifies they're locked **before** working; the buyer **releases** on delivery (or **refunds** after a deadline). Real code, from the kit:

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

The `reference` that seeds the escrow PDA is the **same key** the order is bound to — so the agent protocol and the contract interlock with no new identifier. `seeds = [b"escrow", buyer, reference]` means one box per `(buyer, order)`: no shared "master" box, no replay.

### The lifecycle

```
buyer   deposit(seller, reference, amount, deadline)   🔒 funds locked in PDA(buyer, reference)
seller  isFunded(buyer, seller, reference) ✓           reads the chain before doing the work
seller  deliver → DELIVERED
buyer   release(seller, reference)                     💸 seller paid, box closed (rent → buyer)
   …or, no delivery by the deadline…
buyer   refund(reference)                              ↩ funds returned
```

Neither side can cheat the protocol: the seller can't take funds without a `release`; the buyer can't claw back after releasing, and is protected by the deadline if the seller ghosts.

### What the contract unlocks

The escrow isn't a checkbox — it's what makes these *possible*:

| Build                     | What the agents do                                       | Contract bits                        |
| ------------------------- | -------------------------------------------------------- | ------------------------------------ |
| **Trustless marketplace** | LLM sellers compete; the winner is paid only on delivery | `deposit` / `release` (shipped)      |
| **Dispute resolution**    | an **arbiter agent** adjudicates a contested delivery    | add an `arbitrate` instruction ↓     |
| **Milestone / streaming** | partial releases as a long job progresses                | multiple releases on sub-orders      |
| **Subscriptions**         | a recurring escrow the seller claims per period          | a `claim` instruction + period check |
| **Reputation**            | a PDA per agent; buyers check it before escrowing        | a second account/program             |
| **Staking + slashing**    | sellers stake; bad delivery slashes the stake            | arbiter + a stake account            |

### Expanding the contract

The shipped program is three instructions — [`escrow/programs/escrow/src/lib.rs`](vscode-webview://06rovh67rnqe52v3609t6jk545cn22ogdv5sn0fo4du6atp3jhcc/examples/agent-economy/escrow/programs/escrow/src/lib.rs):

```rust
pub fn initialize(ctx, amount: u64, reference: Pubkey, deadline: i64) -> Result<()>  // buyer deposits
pub fn release(ctx) -> Result<()>                                                     // buyer pays seller
pub fn refund(ctx) -> Result<()>                                                      // buyer reclaims past deadline
// Escrow { buyer, seller, amount, reference, deadline, bump }
```

Two parties means the buyer is judge of its own delivery. To make it **trustless three-party**, bind an **arbiter** at `initialize` and let it break ties:

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

### The headline agent

That instruction unlocks the most compelling build in the kit: an **LLM arbiter agent** — a fourth participant in the CoralOS session that reads a disputed delivery, decides who's right, and calls `arbitrate(pay_seller)`. A reputation-staked judge made of code. It's the moment the economy stops needing *anyone* to be trusted:

* **Agents coordinate** (CoralOS) →
* **funds are escrowed** (the contract) →
* **an agent reasons about the dispute** (LLM) →
* **the contract enforces the verdict** (on-chain).

<br>


---

