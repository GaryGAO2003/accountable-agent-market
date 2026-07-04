# L1 Accountability Spine Checkpoint

Generated: 2026-07-04

## Built

- Added backwards-compatible protocol messages for `BOND_POSTED`, `CHALLENGE_OPENED`,
  `CHALLENGE_UPHELD`, `CHALLENGE_REJECTED`, `SLASHED`, and `ARBITER_SLASHED`.
- Added transfer-backed seller bond posting before delivery. Seller transfers `SELLER_BOND_SOL` to
  `BOND_HOLDER_WALLET` / `ARBITER_WALLET` and emits the bond transaction signature.
- Added an optimistic challenge window controlled by `CHALLENGE_WINDOW_MS`.
- Added buyer objective re-exec challenge behavior. Failed verification emits `CHALLENGE_OPENED`
  when `AUTO_CHALLENGE_ON_FAILED_VERIFY=1`.
- Added a separate `challenger-agent` for the strict L1 role split. Buyer emits `CHALLENGE_REVIEW`,
  challenger-agent re-executes objective evidence, posts `CHALLENGER_BOND_SOL`, and emits
  `CHALLENGE_OPENED by=challenger-agent challenger=<wallet> bondSig=<tx>` only on mismatch.
- Updated arbiter-agent challenge handling:
  - valid delivery / rejected challenge:
    `ARBITER_VERIFIED -> CHALLENGE_REJECTED -> ARBITER_RELEASED -> ARBITER_SLASHED bond=challenger`
  - bad delivery / upheld challenge:
    `ARBITER_REJECTED -> CHALLENGE_UPHELD -> ARBITER_SLASHED bond=seller`
- Implemented devnet slashes as real Solana transfers from the arbiter-held loser bond to the winning
  side. This avoids deployed Anchor program changes for the demo.
- Updated marketplace feed and dashboard folding/rendering for bond, challenge, decision, slash, and
  terminal states: `settled`, `rejected`, `refunded`, `slashed`.
- Updated demo manifests and docs with `SELLER_BOND_SOL`, `CHALLENGER_BOND_SOL`,
  `CHALLENGER_AGENT_ENABLED`, `CHALLENGE_WINDOW_MS`, `AUTO_CHALLENGE_ON_FAILED_VERIFY`,
  `ARBITER_WALLET`, and bond-holder wiring.

## Verified Locally

- `packages/agent-runtime`: `npm test`, `npm run typecheck`, `npm run build`
- `coral-agents/buyer-agent`: `npm test`, `npm run typecheck`
- `coral-agents/arbiter-agent`: `npm test`, `npm run typecheck`
- `coral-agents/challenger-agent`: `npm test`, `npm run typecheck`
- `coral-agents/seller-agent`: `npm test`, `npm run typecheck`
- `examples/marketplace/feed`: `npm test`, `npm run typecheck`
- `examples/marketplace/web`: `npm test`, `npm run typecheck`
- `examples/marketplace`: `npm run typecheck`
- `git diff --check`

## Live Demo Validation

Wallets:

- Buyer: `6S2d9aoUwtfdvgbpiDmE63Ua9rMaDaGwT5DgxwiSK8mD`
- Seller: `3XcNKLx9MMqxPqZBuKgKAdwQyrdHKLoMwWRJotrNK4Kv`
- Arbiter/bond holder: `45L93oJJ6JEr3mw1osLqjXEJmHeVdXQ4CQauSaEnFBJH`

Prereqs completed:

- Buyer balance checked at `1 SOL`.
- Seller funded with `0.01 SOL`:
  `2sfDs5BUtvewVLJJp1p1E8J4xNDMHp8f8fwSavEe9wzJmv4VxHaanH6qrB1Xyw1zjFpHd33K5HZpP7Pz3ehh8CCh`
- Arbiter funded with `0.01 SOL`:
  `67F8T2x4enxKbxinLSaw6i3rdAbpjc8FUEnP58d8Xmt4CGW4u5ezv6AW8GWqqWoCiA1jYyQzUGHcG7EY4cAywJuC`
- `examples/txodds npm run mint` succeeded and wrote `TXLINE_API_KEY`.
- `bash build-agents.sh` rebuilt `seller-agent:0.1.0`, `buyer-agent:0.1.0`, and
  `arbiter-agent:0.1.0`.

Validated sessions:

- Honest direct release session: `2f85e748-fb20-4144-8b5a-3e0b8c6659c7`
  - `DEPOSITED` sig:
    `4oaLCCfFXEv3mbNPKFYGXwRxFfhLHMWTmCHc2xv4zLCH3oFxP25BmyajKkuY9JqQp4rCvMTRSaBxjpw22eCsXZmS`
  - `BOND_POSTED` sig:
    `5piPdTnsG1JCPKFk66K8BxG53UAwZ3T6baJKw1Lh5ST8ApQee3ekWZyDeNP9UtbbYNFaQZgMDSW8CHKxEV9Fjdv8`
  - `VERIFIED round=1 ok=1 code=txline_fixtures_match`
  - `RELEASED` sig:
    `4H1VQMAnBC68FQazDkEMYA3Do9qrDwEmPMenEyvwFBfnuPtV6ufsD7HYRbRHTVewkaMmArU9TJ7nvo1STWD9HevR`
- Rogue no-delivery refund session: `410803a5-c425-4259-87ff-e541a7d910cf`
  - `DEPOSITED` sig:
    `ZCRwxjmHHZyDFw2cHKhDFAsmrkm7xLVnmmnjBVdTyTDGVgarnAqyuGND323J3dB81TDPnc5GTsjyyRH5Un95Kea`
  - `BOND_POSTED` sig:
    `kwddsjdnvvVmBv78WRSfCFNHMN2U9am6qqwsNwcTMY3h1qia625KqesQQVGEQVbf1ikp7QJuFx9Dp3wJw6jod1E`
  - `seller-rogue` logged `DELIVER_MODE=none`.
  - `REFUNDED` sig:
    `5qQWnnQ5rsSt53pzDrJ8aMo7fS8DxugjjovCB77YzpFewTEEboFL7eN2FUMX4tbeFs74ZduQiCrfgZTPBsktm83j`
- Bad-data arbiter challenge/slash session: `11bde463-9eb7-45cd-b391-d248a6c6128f`
  - `DEPOSITED` sig:
    `4kSbdhK8EpTWJcekXNrZ4yjBZR9F5stLcvZ86NiaTopDSLuWdVcyaRTpuKCHGLehB5wUCe6HUcw8c4zdQeA1nUfy`
  - `BOND_POSTED` sig:
    `jXYpoBvkx7RZpVMXzEN8rFMaXH594BWXJb1Rrdp2zuWEaPaCEENDgqm4AQf5Sk6eV1wuw23tXDWXwiqpK6u5oaM`
  - `CHALLENGE_OPENED reason="delivered count 13 != re-exec count 12"`
  - `ARBITER_REJECTED code=txline_count_mismatch`
  - `CHALLENGE_UPHELD code=txline_count_mismatch`
  - `ARBITER_SLASHED` sig:
    `3Uc2XDsvvvtt7jueKxQaG4CLTa5i446tDaBsuco1qM5vdXafooqWNj5VsJfsFsSYGnP7rTvhpyG2cPYexki9pQmc`

Known live limitation and fix:

- Honest `ARBITER_RELEASED` was blocked on the public deployed arbiter program's global config. The
  program is configured for arbiter `Ay2GqHyukwso14RLZWRPhnFMovGGPpVcBzZcnceEiG4Z`, while this
  checkout's generated arbiter is `45L93oJJ6JEr3mw1osLqjXEJmHeVdXQ4CQauSaEnFBJH`, so the live
  arbiter-release attempt failed with `NotArbiter`.
- The code now supports `ARBITER_PROGRAM_ID` for a checkout-owned arbiter wrapper deployment and
  preflights the wrapper `Config` account before opening escrow. If the config is locked to another
  arbiter, buyer/arbiter-agent fail early with both keys instead of stranding a round at release time.
  Direct release and arbiter bad-data slash remain validated.

Post-audit L1 completion:

- Added after the initial live validation: separate challenger role, challenger bond posting, challenger
  wallet propagation into `ARBITER_REVIEW`, and loser-bond labelling for `ARBITER_SLASHED`.
- This completes the strict L1 shape in code:

```text
WANT -> BID -> AWARD -> DEPOSITED -> BOND_POSTED -> DELIVERED
  -> CHALLENGE_REVIEW -> CHALLENGE_OPENED by=challenger-agent bondSig=<tx>
  -> ARBITER_REVIEW -> CHALLENGE_UPHELD / CHALLENGE_REJECTED
  -> ARBITER_SLASHED bond=seller|challenger
```

- Not yet live-revalidated after this post-audit addition. The public arbiter wrapper remains the
  known blocker for live honest `ARBITER_RELEASED`; use a checkout-owned `ARBITER_PROGRAM_ID` before
  claiming that path live.

## Demo Paths

Honest seller:

```text
WANT -> BID -> AWARD -> DEPOSITED -> BOND_POSTED -> DELIVERED
  -> VERIFIED -> challenge window expires -> RELEASED / ARBITER_RELEASED
```

Bad seller:

```text
WANT -> BID -> AWARD -> DEPOSITED -> BOND_POSTED -> DELIVERED
  -> CHALLENGE_REVIEW -> CHALLENGE_OPENED -> ARBITER_REVIEW -> ARBITER_REJECTED
  -> CHALLENGE_UPHELD -> ARBITER_SLASHED bond=seller
```

Use:

```sh
cd examples/marketplace
CHALLENGER_AGENT_ENABLED=1 ARBITER_AGENT_ENABLED=1 DEMO_FAIL_VERIFICATION=1 npm start
```

after buyer/seller devnet funding and `TXLINE_API_KEY` minting are complete.
