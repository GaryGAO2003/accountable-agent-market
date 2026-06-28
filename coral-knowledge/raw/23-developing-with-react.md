<!-- SOURCE: https://xforce-decentralised-protocols.gitbook.io/solanaxcoralos/sol_coralos/frontend/developing-with-react -->

> For the complete documentation index, see [llms.txt](https://xforce-decentralised-protocols.gitbook.io/solanaxcoralos/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://xforce-decentralised-protocols.gitbook.io/solanaxcoralos/sol_coralos/frontend/developing-with-react.md).

# Developing With React

he single-file UI is the kit's default (no build, forkable). When you want a **polished app** — components, routing, real wallet UX — build it in React. The backend doesn't change: **the bridge is your API; React just calls the same endpoints.**

```
React app  ──fetch──▶  bridge (/order, /paid, /autonomous/feed)  ──▶  CoralOS + Solana
```

#### Stack

Vite + React + the Solana wallet-adapter:

```sh
npm create vite@latest web -- --template react-ts
npm i @solana/web3.js @solana/wallet-adapter-react @solana/wallet-adapter-react-ui @solana/wallet-adapter-wallets
```

#### Talk to the bridge in dev — proxy it

The bridge is on `:3010`; Vite dev runs on `:5173`. Proxy so `fetch('/order')` just works (no CORS):

```ts
// vite.config.ts
export default defineConfig({ server: { proxy: {
  '/order': 'http://localhost:3010', '/autonomous': 'http://localhost:3010',
} } })
```

#### The autonomous feed — a polling hook

```tsx
function useFeed() {
  const [messages, setMessages] = useState<{sender:string,text:string}[]>([])
  useEffect(() => {
    const id = setInterval(async () => {
      const r = await fetch('/autonomous/feed').then(r => r.json())
      if (r.messages) setMessages(r.messages)
    }, 2500)
    return () => clearInterval(id)
  }, [])
  return messages
}
// <button onClick={() => fetch('/autonomous/start', {method:'POST'})}>Run demo</button>
// {messages.map(m => <Bubble key={…} who={m.sender} text={m.text} />)}
```

#### The checkout — wallet-adapter + Phantom

The adapter gives you `publicKey` and `sendTransaction`; the flow is the same three calls.

```tsx
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { SystemProgram, Transaction, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'

function useCheckout() {
  const { publicKey, sendTransaction } = useWallet()
  const { connection } = useConnection()
  return async (service: string) => {
    const order = await fetch('/order', { method:'POST',
      headers:{'Content-Type':'application/json'}, body: JSON.stringify({ service }) }).then(r=>r.json())

    const ix = SystemProgram.transfer({ fromPubkey: publicKey!,
      toPubkey: new PublicKey(order.recipient),
      lamports: Math.round(order.amountSol * LAMPORTS_PER_SOL) })
    ix.keys.push({ pubkey: new PublicKey(order.reference), isSigner:false, isWritable:false }) // bind to order
    const sig = await sendTransaction(new Transaction().add(ix), connection)                    // Phantom popup

    return fetch(`/order/${order.reference}/paid`, { method:'POST',
      headers:{'Content-Type':'application/json'}, body: JSON.stringify({ sig }) }).then(r=>r.json())
  }
}
```

Wrap your app in the adapter's `ConnectionProvider` / `WalletProvider` / `WalletModalProvider` (set the endpoint to devnet, add `PhantomWalletAdapter`) and drop in `<WalletMultiButton />` for connect.

#### Ship it

Build to static files and let the bridge serve them — same-origin, no proxy needed in prod:

```ts
// vite build → dist/, then point the bridge's express.static at it (or copy into bridge/web)
```

> **The principle:** React changes *how it looks*, not *how it works*. Every component still calls `/order`, `/order/:ref/paid`, `/autonomous/start`, `/autonomous/feed` — the bridge, CoralOS, and Solana underneath are untouched. So you can build any frontend you want without going near the agents.


---

