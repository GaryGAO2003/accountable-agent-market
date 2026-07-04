# challenger-agent

Independent L1 challenger for the marketplace.

```text
CHALLENGE_REVIEW -> objective re-exec
  -> no mismatch: no challenge
  -> mismatch: post challenge bond -> CHALLENGE_OPENED by=challenger-agent bondSig=<devnet tx>
```

The challenger uses the same objective TxLINE verifier as buyer/arbiter, but it is a separate CoralOS
participant. Its bond is transfer-backed for the hackathon demo: `CHALLENGER_BOND_SOL` moves from
`CHALLENGER_KEYPAIR_B58` to `BOND_HOLDER_WALLET` / `ARBITER_WALLET` before the challenge is opened.

Required env:

- `CHALLENGER_KEYPAIR_B58`
- `BOND_HOLDER_WALLET` or `ARBITER_WALLET`
- `TXLINE_API_KEY`
