# SupplySwarm

SupplySwarm is a mobile-first hackathon vertical slice that turns a business brief and budget into a transparent procurement package sourced from live Alibaba.com search. Built for **Track 3: Agent Society**, it demonstrates each judging criterion directly:

- **Task decomposition & role assignment** — a Coordinator agent designs a bespoke specialist team per brief, giving each agent its own Alibaba search query and budget share; specialists execute in parallel with live web search.
- **Dialogue, disagreement & conflict resolution** — every event is `who → to` agent dialogue. The Supplier agent *vetoes* cited links that were not in an agent's real search results; specialists that overshoot their allocation *negotiate* for budget and the Coordinator arbitrates using real headroom from underspenders; a Critic agent revises over-budget packages and messages the specific agents whose lines it cut.
- **Measured efficiency gain over a single-agent baseline** — every live run also fires one solo Qwen agent with identical tools as a parallel control. Both packages are scored by the same deterministic validators (verified listing links, landed-cost budget validity, wall-clock seconds), and the results page shows the measured comparison plus the parallel-sourcing speed-up. Nothing is scripted.

## 3D / VR operations room

"Enter 3D Ops Room · VR" opens an empty, idle Three.js operations room. Hold the centre coordinator while you speak, then release: Qwen transcribes the brief, plans the launch, and only then beams the specialist robots into the room. The robots don't just stand there — each agent walks over to whoever it is addressing, faces them, shows a speech bubble with its actual message, and fires a message pulse along a line between the two robots, while idle agents drift and scan near their stations. A typed brief remains available as a fallback. On WebXR-capable devices (e.g. Meta Quest browser), **Enter VR** launches an immersive `immersive-vr` session; point a controller at the coordinator and hold its trigger to talk. On desktop and mobile you can orbit and zoom the same scene. Three.js is lazy-loaded only when the room is entered, so the base app stays lightweight.

## Qwen Cloud live mode

Set **`DASHSCOPE_API_KEY`** (Railway → your service → Variables) and the app switches from the demo catalogue to live Qwen Cloud:

- **Planning** — a real multi-agent pipeline on `qwen3.7-plus`. The Coordinator call extracts the brief and designs the specialist team with per-agent Alibaba search queries and budget shares. Each specialist then runs its **own Qwen call with live web search enabled** (DashScope `enable_search` + `forced_search` + `enable_source`), in parallel, searching `site:alibaba.com` for its category. Any URL a specialist cites is validated against the actual search results it received — verified links are labelled "Live Alibaba listing", anything else is labelled an estimate. A deterministic calculator (not the LLM) computes shipping, VAT/duties, contingency and the landed total; if the package breaks the budget, a genuine Critic revision round runs and messages the specific agents whose lines were changed. Every event carries `who → to`, so the swarm visibly talks to itself in the console and the 3D room.
- **Voice input** — the mic button records your brief and transcribes it with `qwen3-asr-flash`.
- **Concept image** — the results page can generate an illustrative visual of the finished business with `qwen-image-2.0-pro`.

Optional env overrides: `QWEN_BASE_URL`, `QWEN_TEXT_MODEL`, `QWEN_ASR_MODEL`, `QWEN_IMAGE_MODEL`, `QWEN_IMAGE_SIZE`. See `.env.example`.

Without a key the app runs in clearly-labelled demo-catalogue mode — nothing is simulated as live.

## Run locally

```powershell
npm.cmd install
npm.cmd run build        # build the frontend once (server serves dist/)
npm.cmd run dev:server   # API + static on :8787
npm.cmd run dev          # optional: Vite dev server on :5173, proxies /api to :8787
```

## Deploy (Railway)

Railway auto-detects Node: build command `npm run build`, start command `npm start`. The Express server serves both the API and the built frontend on `PORT`. Set `DASHSCOPE_API_KEY` in service variables.

## Data honesty

In live mode, item links point to real Alibaba.com listings that appeared in Qwen's web-search results — cited URLs that did not appear in the search results are stripped and the line is downgraded to a labelled estimate. Prices remain model readings of listings, not supplier quotations; confirm price and MOQ on the listing itself. No purchases or supplier messages are ever sent. The demo catalogue remains available as a fallback and is always labelled as demo data.
