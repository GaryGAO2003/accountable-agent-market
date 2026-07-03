# arbiter-agent

Neutral marketplace verifier. The buyer opens arbiter escrow and sends `ARBITER_REVIEW` into the
CoralOS thread; this agent re-executes the TxLINE objective predicate, emits `ARBITER_VERIFIED` or
`ARBITER_REJECTED`, then signs `arbitrate_release` for passing deliveries.

Rejected deliveries do not release funds. Set `ARBITER_REFUND_ON_REJECT=1` to attempt
`arbitrate_refund`; the escrow deadline still applies, so this is normally a post-deadline operation.

```text
ARBITER_REVIEW -> ARBITER_VERIFIED -> ARBITER_RELEASED
ARBITER_REVIEW -> ARBITER_REJECTED  -> optional ARBITER_REFUNDED
```
