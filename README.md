# SupplySwarm

> **Architecture docs:** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — pipeline diagrams, Qwen API usage, validation/honesty layer, module map.
> **Alibaba Cloud proof:** [docs/ALIBABA_CLOUD_DEPLOYMENT.md](docs/ALIBABA_CLOUD_DEPLOYMENT.md) — deployment code, public verification endpoint, and Workbench evidence.

SupplySwarm is a mobile-first hackathon vertical slice that turns a business brief and budget into a transparent procurement package sourced from live Alibaba.com search. Built for **Track 3: Agent Society**, it demonstrates each judging criterion directly:

- **Task decomposition & role assignment** — a Coordinator agent designs a bespoke specialist team per brief, giving each agent its own Alibaba search query and budget share; specialists execute in parallel with live web search.
- **Dialogue, disagreement & conflict resolution** — every event is `who → to` agent dialogue, and the conflicts are argued by the models themselves. The Supplier agent *vetoes* cited links that were not in an agent's real search results. When a specialist overshoots its allocation, it pleads its own case in its **own Qwen call** (grounded in its actual items and reasoning) and the Coordinator **rules on the plea in a separate Qwen call** — deterministic code then clamps whatever they agreed to the real headroom, so the argument is genuine but the arithmetic can't lie. A Critic agent revises over-budget packages, upgrades underspent ones, and messages the specific agents whose lines it changed. Conflicts, vetoes and memory recalls are visibly tagged in every UI.
- **Persistent per-agent memory** — every finished mission is recorded per agent role (spend vs allocation, vetoed links, negotiated budget, prices paid). On the next brief, deterministic keyword recall finds relevant past missions and briefs **each agent with its own experience** — the Coordinator allocates shares more wisely, specialists remember what racks or workstations cost last time and that their links were vetoed, and the Critic remembers which categories broke the ceiling. What each agent remembers is inspectable on the phone companion, in the 3D room's thought bubbles, and via `GET /api/memory`.
- **Measured efficiency gain over a single-agent baseline** — every live run also fires one solo Qwen agent with identical tools as a parallel control. Both packages are scored by the same deterministic validators (verified listing links, landed-cost budget validity, wall-clock seconds), and the results page shows the measured comparison plus the parallel-sourcing speed-up. Nothing is scripted.

## Swarm memory

The swarm learns. `server/memory.js` keeps a file-backed record of every completed mission — per-role facts only (what was spent against which allocation, which links were vetoed, what was bought and for how much, how negotiations ended). Recall is deterministic keyword scoring, so the memory layer itself can never hallucinate; the recalled facts are injected into the Coordinator, specialist and Critic prompts as each agent's own remembered experience. Role matching survives renaming: a "Lifting" agent inherits what a past "Strength" agent learned because their search queries overlap. The landing page shows the swarm's memory at a glance, the companion phone shows a "Remembers from past missions" panel per agent, and agents in the 3D room surface their memories as thought bubbles while they work.

## 3D / VR operations room

"Use in VR" opens an empty, idle Three.js operations room, set-dressed with low-poly cargo pallets modelled in Blender and baked to a 94 KB GLB. Hold the centre coordinator while you speak, then release: Qwen transcribes the brief, plans the launch, and only then beams the specialist robots into the room. The robots don't just stand there — each agent walks over to whoever it is addressing, faces them, shows a speech bubble with its actual message, and fires a message pulse along a line between the two robots, while idle agents drift and scan near their stations. Between events, agents surface **thought bubbles** containing the genuine reasoning steps each Qwen specialist returned while comparing listings. The room is interactive: **tap any robot** (or point a VR controller at it and pull the trigger) and it turns to you and reports its role, sourced lines and spend. A typed brief remains available as a fallback. On WebXR-capable devices (e.g. Meta Quest browser), **Enter VR** launches an immersive `immersive-vr` session; point a controller at the coordinator and hold its trigger to talk. **Passthrough AR** launches an `immersive-ar` session instead: your real room shows through the headset cameras, WebXR **hit-test with plane detection** finds real surfaces (floor, desk, table), a reticle tracks the detected surface, and the first trigger pull sets a miniature of the whole ops room down on it — the swarm then negotiates on your actual desk, and every interaction (hold-to-talk, tap-to-inspect, speech and thought bubbles) works identically in AR. On desktop and mobile you can orbit and zoom the same scene. Three.js is lazy-loaded only when the room is entered, so the base app stays lightweight.

## Connect code — pair your phone with the headset

Opening the 3D Ops Room registers the session over WebSocket and shows a 5-letter **PHONE LINK** code in the HUD (click it to copy the join URL). Anyone can then visit **`/connect`** on a phone, enter the code, and get a live companion dashboard: colourful agent bubbles that pulse as each agent speaks, tap-to-inspect cards showing what an agent is thinking, saying and has sourced (with spend and listing links), and a composer to **send requests to a specific agent or the Hub** — the message appears instantly as an orange bubble above that robot in the VR room. When the plan is ready the phone gets the full results (totals, live listings, the measured single-agent comparison, concept image) and a **downloadable branded PDF report**. The server keeps a session snapshot, so a phone that joins late — or reconnects — catches up instantly; up to 8 companions can watch one session.

## Qwen Cloud live mode

Set **`DASHSCOPE_API_KEY`** (Railway → your service → Variables) and the app switches from the demo catalogue to live Qwen Cloud:

- **Planning** — a real multi-agent pipeline on `qwen3.7-plus`. The Coordinator call extracts the brief and designs the specialist team with per-agent Alibaba search queries and budget shares. Each specialist then runs its **own Qwen call with live web search enabled** (DashScope `enable_search` + `forced_search` + `enable_source`), in parallel, searching `site:alibaba.com` for its category. Any URL a specialist cites is validated against the actual search results it received — verified links are labelled "Live Alibaba listing"; unlinked lines are handed a real listing URL from the agent's own search results where one exists, anything else is labelled an estimate. A deterministic calculator (not the LLM) computes shipping, VAT/duties, contingency and the landed total; if the package breaks the budget, a genuine Critic revision round runs and messages the specific agents whose lines were changed; if it leaves most of the budget unused, an equivalent Critic upgrade round spends it properly. Every event carries `who → to`, so the swarm visibly talks to itself in the console and the 3D room.
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

## Deploy (Alibaba Cloud)

The hackathon production bundle targets **Alibaba Cloud ECS or Simple Application Server**. It includes a multi-stage [`Dockerfile`](Dockerfile), an Alibaba-specific [`docker-compose.yml`](deploy/alibaba-cloud/docker-compose.yml), persistent swarm-memory storage, a container health check, and non-secret provider/region/commit evidence in `/api/health`.

See [`deploy/alibaba-cloud/README.md`](deploy/alibaba-cloud/README.md) for the exact Workbench deployment and proof-capture steps.

## Existing HTTPS demo (Railway)

Railway auto-detects Node: build command `npm run build`, start command `npm start`. The Express server serves both the API and the built frontend on `PORT`. Set `DASHSCOPE_API_KEY` in service variables.

## Data honesty

In live mode, item links point to real Alibaba.com listings that appeared in Qwen's web-search results — cited URLs that did not appear in the search results are stripped and the line is downgraded to a labelled estimate. Prices remain model readings of listings, not supplier quotations; confirm price and MOQ on the listing itself. No purchases or supplier messages are ever sent. The demo catalogue remains available as a fallback and is always labelled as demo data.
