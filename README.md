# SupplySwarm

SupplySwarm turns a business brief and budget into a transparent procurement package. The whole experience lives in two places: the **VR operations room** and a **mobile companion**. The landing page offers exactly two doors — *Use in VR* and *Join session on mobile*.

## VR operations room (host)

"Use in VR" opens the Three.js operations room and creates a realtime session with a 4-letter join code (shown in the HUD, on the status board, and on a floating panel in the scene). Hold the centre coordinator while you speak, then release: Qwen transcribes the brief, plans the launch, and beams the specialist robots into the room. A typed brief remains available as a fallback. On WebXR devices (e.g. Meta Quest browser), **Enter VR** starts an immersive session at full framebuffer scale with fixed foveation disabled for sharpness; point a controller at the coordinator and hold the trigger to talk. ElevenLabs-generated ambient music and SFX (hold, release, robot spawn, events, completion) play throughout.

## Mobile companion

"Join session on mobile" asks for the 4-letter code (deep link: `/?join=CODE`). The phone connects over Server-Sent Events and can **send the brief** (typed or spoken), then follows every agent event, phase and progress update live. When the run finishes the phone receives the full plan: concept image, itemised package with **Alibaba.com search links per product**, landed-cost breakdown, risks/assumptions, and a **Download PDF** button. The PDF (generated server-side with pdfkit) embeds the concept image, the full package with clickable Alibaba links, and the cost model.

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

Live-mode prices are Qwen model estimates, labelled as such — not supplier quotations. Product links open **live Alibaba.com marketplace searches** (the Qwen planner writes a search query per item), so the products behind each line are real listings the user verifies themselves. No purchases or supplier messages are ever sent. The demo catalogue remains available as a fallback and is always labelled as demo data.

## Realtime sessions

Sessions are in-memory on the server: `POST /api/session` issues a code, phones subscribe to `GET /api/session/:code/stream` (SSE), briefs flow phone → headset, events flow headset → phones, and `GET /api/session/:code/report.pdf` serves the finished plan. The concept image is fetched server-side at completion because Qwen image URLs expire.
