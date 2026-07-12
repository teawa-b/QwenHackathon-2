# SupplySwarm

SupplySwarm is a mobile-first hackathon vertical slice that turns a business brief and budget into a transparent procurement package. It demonstrates dynamic specialist agents, visible collaboration, deterministic landed-cost calculations, a critic/revision loop, evidence labels, and human approval gates.

## 3D / VR operations room

"Enter 3D Ops Room · VR" opens an empty, idle Three.js operations room. Hold the centre coordinator while you speak, then release: Qwen transcribes the brief, plans the launch, and only then beams the specialist robots into the room. A typed brief remains available as a fallback. On WebXR-capable devices (e.g. Meta Quest browser), **Enter VR** launches an immersive `immersive-vr` session; point a controller at the coordinator and hold its trigger to talk. On desktop and mobile you can orbit and zoom the same scene. Three.js is lazy-loaded only when the room is entered, so the base app stays lightweight.

## Qwen Cloud live mode

Set **`DASHSCOPE_API_KEY`** (Railway → your service → Variables) and the app switches from the demo catalogue to live Qwen Cloud:

- **Planning** — `qwen3.7-plus` acts as the Coordinator: it extracts the brief, designs the specialist agent team, prices a realistic equipment package, and narrates real agent events. A deterministic calculator (not the LLM) computes shipping, VAT/duties, contingency and the landed total; if the package breaks the budget, a genuine Critic revision round runs before approval.
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

Live-mode prices are Qwen model estimates, labelled as such — not supplier quotations or live Alibaba listings. No purchases or supplier messages are ever sent. The demo catalogue remains available as a fallback and is always labelled as demo data.
