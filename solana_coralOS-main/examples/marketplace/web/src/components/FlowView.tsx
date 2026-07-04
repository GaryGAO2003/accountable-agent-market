import { useEffect, useRef, useState } from 'react'

/**
 * "Follow the money" — the accountability tab. Money only ever sits in three places (buyer wallet,
 * our escrow contract, seller wallet); three replayable scenarios show a coin travel between them
 * and where our software intervenes (lock / verify / deadline refund). Ported 1:1 from the approved
 * prototype in /design/flow-tab-template.html; the two proof links are real devnet transactions.
 */

const PATHS = {
  dep: 'M 246 178 C 300 168, 314 168, 366 174',
  rel: 'M 644 174 C 696 168, 712 168, 764 178',
  ref: 'M 505 252 C 512 330, 300 336, 236 250',
}
const RELEASED_TX =
  'https://explorer.solana.com/tx/3f6RvMvczR5iiMmfWaoKaYzbtGsZpn97325BesGUqQeSUPsQThdnZGzEaLNH5NF9zyuqNy5f1LLRexZnA4s49nWj?cluster=devnet'
const REFUNDED_TX =
  'https://explorer.solana.com/tx/4Gpytv3y98LHa5bPCuL8xSpmFCyctxzMPQXjva2GWUzpwiWnerPcfa3QDQ9ysCuWxsvrqZF6EDeGcXCs182nCiBQ?cluster=devnet'

type Scenario = 'honest' | 'ghost' | 'fraud' | 'hijack'
/** One receipt line: parts render in order, `{ b }` parts in bold (colored by `cls`). */
interface LogLine { cls: string; parts: Array<string | { b: string }> }

const L: Record<string, LogLine> = {
  want: { cls: 'lv-want', parts: [{ b: 'WANT' }, ' txline fixtures budget=0.001'] },
  bids: { cls: 'lv-bid', parts: [{ b: 'BID' }, ' ×4 — cheap 0.0004 · honest 0.0007 · premium 0.0009 · rogue 0.00025'] },
  award: { cls: 'lv-award', parts: [{ b: 'AWARD' }, ' → seller-rogue — "lowest price with verified reliability"'] },
  awardH: { cls: 'lv-award', parts: [{ b: 'AWARD' }, ' → seller-honest — "fair price, reliable quality"'] },
  dep: { cls: 'lv-us', parts: [{ b: 'DEPOSITED' }, ' 0.00025 SOL → escrow vault · our contract now holds it'] },
  depH: { cls: 'lv-us', parts: [{ b: 'DEPOSITED' }, ' 0.0008 SOL → escrow vault · our contract now holds it'] },
  del: { cls: 'lv-del', parts: [{ b: 'DELIVERED' }, ' {"FixtureCount":24,…} — real TxODDS payload'] },
  delF: { cls: 'lv-del', parts: [{ b: 'DELIVERED' }, ' {"FixtureCount":9,…} — forged (bad_count)'] },
  ghost: { cls: 'lv-x', parts: [{ b: '…silence.' }, ' rogue log: "taking the escrow hostage" — no delivery ever comes'] },
  ver: { cls: 'lv-us', parts: [{ b: 'VERIFIED' }, ' ok=1 — payload matches our own independent TxLINE re-exec'] },
  verF: { cls: 'lv-x', parts: [{ b: 'VERIFICATION_FAILED' }, ' — our re-exec says 24 fixtures, seller said 9'] },
  wait: { cls: 'lv-us', parts: ['deadline hits — buyer signs ', { b: 'refund()' }, ', no seller permission needed'] },
  waitF: { cls: 'lv-us', parts: ['bad data = no delivery — deadline hits, buyer signs ', { b: 'refund()' }] },
  rel: { cls: 'lv-rel', parts: [{ b: 'RELEASED' }, ' sig=3f6RvMv… — vault → seller wallet'] },
  ref: { cls: 'lv-ref', parts: [{ b: 'REFUNDED' }, ' sig=4Gpytv3… — vault → buyer wallet · rogue earned 0'] },
  escHj: { cls: 'lv-x', parts: [{ b: 'ESCROW_REQUIRED' }, ' payout=9xF0…rEIGN — seller names a wallet that is not its market identity'] },
  denyHj: { cls: 'lv-us', parts: [{ b: 'EGRESS_DENIED' }, ' code=RECIPIENT_NOT_ALLOWED action=deposit — payout not allow-listed; deposit refused, 0 SOL moved'] },
}

interface Badge { state: string; cls: string }
const IDLE = {
  scn: null as Scenario | null,
  chips: { want: '', bids: '', award: '' },
  lock: { state: 'idle', cls: '' } as Badge,
  verify: { state: 'idle', cls: '' } as Badge,
  deadline: { state: 'armed', cls: '' } as Badge,
  bal: { buyer: '1.00000', vault: '0.00000', seller: '2.43100' },
  fly: { cls: '', text: '📦 DELIVERED —' },
  live: { dep: false, rel: false, ref: false },
  verdict: null as 'paid' | 'back' | 'blocked' | null,
  sellerNote: 'delivers real TxODDS data… or tries not to',
  lines: [] as LogLine[],
}

const STEP = 850

export function FlowView() {
  const [s, setS] = useState(IDLE)
  const timers = useRef<number[]>([])
  const coinRef = useRef<HTMLSpanElement>(null)
  const logRef = useRef<HTMLDivElement>(null)
  // jsdom has no matchMedia — treat that as reduced motion so tests (and odd browsers) settle instantly
  const reduced =
    typeof window.matchMedia !== 'function' || window.matchMedia('(prefers-reduced-motion: reduce)').matches

  useEffect(() => () => { timers.current.forEach(clearTimeout) }, [])
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [s.lines])

  const at = (ms: number, fn: () => void) => {
    if (reduced) fn()
    else timers.current.push(window.setTimeout(fn, ms))
  }
  const patch = (p: Partial<typeof IDLE>) => setS((prev) => ({ ...prev, ...p }))
  const put = (line: LogLine) => setS((prev) => ({ ...prev, lines: [...prev.lines, line] }))
  const pulse = (key: 'lock' | 'verify' | 'deadline', state: string, cls: '' | 'ok' | 'bad' = '') => {
    setS((prev) => ({ ...prev, [key]: { state, cls: `pulse ${cls}`.trim() } } as typeof prev))
    at(900, () => setS((prev) => ({ ...prev, [key]: { ...prev[key], cls } } as typeof prev)))
  }
  const flyCoin = (path: keyof typeof PATHS, ms: number, label: string) => {
    setS((prev) => ({ ...prev, live: { ...prev.live, [path]: true } } as typeof prev))
    const coin = coinRef.current
    if (reduced || !coin) return
    coin.textContent = label
    coin.style.offsetPath = `path('${PATHS[path]}')`
    coin.style.setProperty('--coin-ms', `${ms}ms`)
    coin.classList.remove('go')
    void coin.offsetWidth
    coin.classList.add('go')
  }

  function play(name: Scenario) {
    timers.current.forEach(clearTimeout)
    timers.current = []
    coinRef.current?.classList.remove('go')
    setS({ ...IDLE, scn: name })
    const honest = name === 'honest'
    const ghost = name === 'ghost'
    const hijack = name === 'hijack'
    const amt = honest ? '0.0008' : '0.00025'
    let t = 0

    at(t, () => { patch({ chips: { want: 'on', bids: '', award: '' } }); put(L.want) }); t += STEP
    at(t, () => { patch({ chips: { want: 'on', bids: 'on', award: '' } }); put(L.bids) }); t += STEP
    at(t, () => { patch({ chips: { want: 'on', bids: 'on', award: 'won' } }); put(honest ? L.awardH : L.award) }); t += STEP

    if (hijack) {
      // The seller wins, then names a FOREIGN payout wallet. The buyer's PEP inspects the target and
      // refuses the deposit: the coin never leaves home — nothing touches the vault or the chain. No
      // balance moves (buyer stays at the full starting balance, vault 0, seller earns nothing), and
      // there is deliberately no Explorer link because nothing settled on-chain (the honesty rule).
      at(t, () => { patch({ fly: { cls: 'bad', text: '⚠ payout → foreign wallet' } }); put(L.escHj) }); t += STEP
      at(t, () => { pulse('lock', 'refused ✕', 'bad'); put(L.denyHj) }); t += STEP
      at(t, () => {
        setS((prev) => ({
          ...prev,
          verdict: 'blocked',
          sellerNote: 'won the auction — payout wallet refused, earned nothing',
        }))
      })
      return
    }

    at(t, () => { flyCoin('dep', 1100, `◉ ${amt}`); put(honest ? L.depH : L.dep) }); t += 1100
    at(t, () => {
      setS((prev) => ({
        ...prev,
        bal: { ...prev.bal, buyer: honest ? '0.99920' : '0.99975', vault: honest ? '0.00080' : '0.00025' },
        deadline: { ...prev.deadline, state: honest ? '600s' : '45s' },
      }))
      pulse('lock', 'locked ✓', 'ok')
    }); t += STEP

    if (ghost) {
      at(t, () => { patch({ fly: { cls: 'bad', text: '📦 …silence' } }); put(L.ghost) }); t += STEP
      at(t, () => { pulse('deadline', '45s passed', 'bad'); put(L.wait) }); t += STEP
    } else if (!honest) {
      at(t, () => { patch({ fly: { cls: 'bad', text: '📦 forged payload' } }); put(L.delF) }); t += STEP
      at(t, () => { pulse('verify', 'mismatch ✕', 'bad'); put(L.verF) }); t += STEP
      at(t, () => { pulse('deadline', '45s passed', 'bad'); put(L.waitF) }); t += STEP
    } else {
      at(t, () => { patch({ fly: { cls: 'on', text: '📦 DELIVERED ✓' } }); put(L.del) }); t += STEP
      at(t, () => { pulse('verify', 'match ✓', 'ok'); put(L.ver) }); t += STEP
    }

    if (honest) {
      at(t, () => { flyCoin('rel', 1100, `◉ ${amt}`); put(L.rel) }); t += 1100
      at(t, () => {
        setS((prev) => ({
          ...prev,
          bal: { ...prev.bal, vault: '0.00000', seller: '2.43180' },
          verdict: 'paid',
        }))
      })
    } else {
      at(t, () => { flyCoin('ref', 1300, `◉ ${amt}`); put(L.ref) }); t += 1300
      at(t, () => {
        setS((prev) => ({
          ...prev,
          bal: { ...prev.bal, vault: '0.00000', buyer: '1.00000' },
          verdict: 'back',
          sellerNote: 'won the auction — earned nothing',
        }))
      })
    }
  }

  return (
    <section className="flow-panel" data-testid="flow">
      <h2 className="flow-title">Follow the money — <b>no path loses the buyer's funds</b></h2>
      <p className="flow-lede">
        Money only ever sits in three places: the buyer's wallet, the seller's wallet, and{' '}
        <span className="u-us">our escrow contract</span> between them. Agents negotiate for free; the
        moment money moves, <span className="u-us">our software</span> is holding it — it locks, verifies
        the goods independently, and refunds by deadline if anything is wrong.
      </p>

      <div className="scn-row" role="group" aria-label="scenarios">
        <span className="scn-label">PLAY A ROUND →</span>
        <button className={`scn scn-honest ${s.scn === 'honest' ? 'on' : ''}`} type="button"
          data-testid="flow-scn-honest" onClick={() => play('honest')}>✓ honest seller delivers</button>
        <button className={`scn scn-ghost ${s.scn === 'ghost' ? 'on' : ''}`} type="button"
          data-testid="flow-scn-ghost" onClick={() => play('ghost')}>✕ rogue wins &amp; ghosts</button>
        <button className={`scn scn-fraud ${s.scn === 'fraud' ? 'on' : ''}`} type="button"
          data-testid="flow-scn-fraud" onClick={() => play('fraud')}>△ seller ships fake data</button>
        <button className={`scn scn-hijack ${s.scn === 'hijack' ? 'on' : ''}`} type="button"
          data-testid="flow-scn-hijack" onClick={() => play('hijack')}>🛡 seller swaps payout wallet</button>
      </div>

      <div className="canvas-scroll">
        <div className="canvas">
          <svg className="paths" width="1010" height="388" viewBox="0 0 1010 388" aria-hidden="true">
            <path className={`p ${s.live.dep ? 'p-live-sky' : ''}`} d={PATHS.dep} />
            <path className={`p ${s.live.rel ? 'p-live-mint' : ''}`} d={PATHS.rel} />
            <path className={`p ${s.live.ref ? 'p-live-coral' : ''}`} d={PATHS.ref} />
            <polygon className="arrowhead" points="366,174 356,169 357,180" />
            <polygon className="arrowhead" points="764,178 754,173 755,184" />
            <polygon className="arrowhead" points="236,250 240,261 246,251" />
          </svg>

          <div className="talk">
            <span className="talk-label">AGENTS NEGOTIATE — NO FUNDS MOVED</span>
            <div className="talk-chips">
              <span className={`chip ${s.chips.want}`}>WANT txline · budget 0.001</span>
              <span className={`chip ${s.chips.bids}`}>BID ×4</span>
              <span className={`chip ${s.chips.award}`}>AWARD + reason</span>
            </div>
          </div>

          <div className="home home-buyer">
            <div className="home-who">WALLET</div>
            <div className="home-name">🧍 Buyer agent</div>
            <div className="home-bal"><span data-testid="flow-bal-buyer">{s.bal.buyer}</span> <small>SOL</small></div>
            <div className="home-note">shops with a budget, pays only for verified goods</div>
          </div>

          <div className="home vault" data-testid="flow-vault">
            <span className="vault-tag">OUR CONTRACT · ON-CHAIN</span>
            <div className="home-name" style={{ marginTop: 6 }}>🏛 Escrow vault</div>
            <div className="home-bal"><span data-testid="flow-bal-vault">{s.bal.vault}</span> <small>SOL locked</small></div>
            <div className={`iv ${s.lock.cls}`}>🔒 <b>locks funds</b><span className="iv-state">{s.lock.state}</span></div>
            <div className={`iv ${s.verify.cls}`}>🔍 <b>re-checks the goods</b><span className="iv-state">{s.verify.state}</span></div>
            <div className={`iv ${s.deadline.cls}`}>⏱ <b>deadline → refund()</b><span className="iv-state">{s.deadline.state}</span></div>
          </div>

          <div className={`home home-seller ${s.verdict === 'paid' ? 'glow-mint' : ''}`}>
            <div className="home-who">WALLET</div>
            <div className="home-name">🤝 Winning seller</div>
            <div className="home-bal"><span data-testid="flow-bal-seller">{s.bal.seller}</span> <small>SOL</small></div>
            <div className="home-note">{s.sellerNote}</div>
          </div>

          <span className={`fly ${s.fly.cls}`}>{s.fly.text}</span>
          <span className="coin" ref={coinRef}>◉ 0.0008</span>

          <div className={`verdict verdict-paid ${s.verdict === 'paid' ? 'show' : ''}`} data-testid="flow-verdict-paid">
            Seller paid for verified work{' '}
            <a href={RELEASED_TX} target="_blank" rel="noreferrer">RELEASED ↗ real devnet tx</a>
          </div>
          <div className={`verdict verdict-back ${s.verdict === 'back' ? 'show' : ''}`} data-testid="flow-verdict-back">
            Money returned — cheater earned 0{' '}
            <a href={REFUNDED_TX} target="_blank" rel="noreferrer">REFUNDED ↗ real devnet tx</a>
          </div>
          <div className={`verdict verdict-blocked ${s.verdict === 'blocked' ? 'show' : ''}`} data-testid="flow-verdict-blocked">
            🛡 PEP blocked · RECIPIENT_NOT_ALLOWED
            <span className="verdict-note">deposit refused — nothing moved, nothing settled on-chain</span>
          </div>
        </div>
      </div>

      <div className="flow-log" data-testid="flow-log" aria-live="polite" ref={logRef}>
        {s.lines.length === 0 ? (
          <div className="log-line log-hint">// pick a scenario above — the receipt of every message prints here</div>
        ) : (
          s.lines.map((line, i) => (
            <div key={i} className={`log-line ${line.cls}`}>
              {'> '}
              {line.parts.map((p, j) => (typeof p === 'string' ? p : <b key={j}>{p.b}</b>))}
            </div>
          ))
        )}
      </div>

      <div className="flow-legend">
        <span className="key"><span className="sw sw-gray" /> negotiation — free, no funds move</span>
        <span className="key"><span className="sw sw-violet" /> our software holds, checks &amp; refuses bad payouts</span>
        <span className="key"><span className="sw sw-mint" /> released to the seller</span>
        <span className="key"><span className="sw sw-coral" /> refunded to the buyer</span>
      </div>

      <p className="punch">A seller can win the auction and still earn nothing — by ghosting, shipping fake
      data, or swapping in a foreign payout wallet. The first two refund on-chain; the last never deposits
      at all — our policy check stops it before a single lamport moves. <b>Cheating costs the cheater,
      never the buyer.</b></p>
    </section>
  )
}
