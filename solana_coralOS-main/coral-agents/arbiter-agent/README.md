# arbiter-agent

Neutral marketplace verifier. The buyer opens arbiter escrow and sends `ARBITER_REVIEW` into the
CoralOS thread; this agent re-executes the TxLINE objective predicate, emits `ARBITER_VERIFIED` or
`ARBITER_REJECTED`, then signs `arbitrate_release` for rejected challenges or slashes the seller bond
for upheld challenges.

Rejected deliveries do not release funds. Set `ARBITER_REFUND_ON_REJECT=1` to attempt
`arbitrate_refund`; the escrow deadline still applies, so this is normally a post-deadline operation.

```text
ARBITER_REVIEW -> ARBITER_VERIFIED -> CHALLENGE_REJECTED -> ARBITER_RELEASED -> ARBITER_SLASHED bond=challenger
ARBITER_REVIEW -> ARBITER_REJECTED  -> CHALLENGE_UPHELD -> ARBITER_SLASHED bond=seller
```

The current L1 demo uses transfer-backed bonds: seller-agent posts `SELLER_BOND_SOL` to the arbiter
wallet before delivery, and challenger-agent posts `CHALLENGER_BOND_SOL` before opening a dispute.
arbiter-agent transfers the loser bond to the winner: seller bond to the challenger when objective
re-exec rejects delivery, or challenger bond to the seller when the challenge is rejected.

Set `ARBITER_PROGRAM_ID` when using a checkout-owned arbiter wrapper deployment. The agent preflights
the wrapper config and exits before signing if the deployed config is locked to a different arbiter
than `ARBITER_KEYPAIR_B58`, preventing the known shared-devnet `NotArbiter` failure.
