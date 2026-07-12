# SupplySwarm — Architecture

SupplySwarm is a multi-agent procurement system (**Track 3: Agent Society**). A user describes a business in one sentence (typed, or spoken to a 3D robot); a society of Qwen-powered agents decomposes the task, searches Alibaba.com live, negotiates over a shared budget, resolves conflicts, and returns an evidence-linked equipment package — measured against a single-agent control on every run.

## System overview

```mermaid
flowchart TB
    subgraph Client [Browser — Vite + vanilla JS + Three.js]
        UI[2D console UI]
        XR[3D / WebXR ops room<br/>walking robots · speech + thought bubbles · tap-to-inspect]
        MIC[Hold-to-talk mic<br/>WebM→WAV re-encode in browser]
    end

    subgraph Server [Express — server/]
        API[/api/plan · /api/transcribe · /api/image/]
        PL[planner.js — agent society orchestrator]
        QW[qwen.js — Qwen Cloud client]
    end

    subgraph Qwen [Qwen Cloud / DashScope]
        TXT[qwen3.7-plus<br/>chat + JSON mode]
        SRCH[qwen3.7-plus + enable_search<br/>forced live web search w/ cited sources]
        ASR[qwen3-asr-flash]
        IMG[qwen-image-2.0-pro]
    end

    MIC --> API --> ASR
    UI & XR --> API --> PL --> QW
    QW --> TXT & SRCH & IMG
```

## The agent society (server/planner.js)

One `/api/plan` request runs a full multi-agent pipeline. Each box is a **separate Qwen call with its own role prompt**; specialists and the control run execute **concurrently**.

```mermaid
sequenceDiagram
    participant U as User brief
    participant C as Coordinator (Qwen)
    participant S1 as Specialist ×N (Qwen + live web search, parallel)
    participant B as Single agent control (Qwen + search, parallel)
    participant V as Deterministic validators (no LLM)
    participant K as Critic (Qwen)

    U->>C: business, city, team, budget
    C->>S1: role, focus, Alibaba query, budget share
    C->>B: same brief, no team (baseline)
    S1-->>V: items + cited URLs + reasoning "thoughts"
    Note over V: URL verification: a link survives ONLY if it<br/>appeared in that agent's real search results
    V->>V: budget-share negotiation (overspenders ask,<br/>Coordinator reallocates real headroom)
    V->>V: landed cost = products + 7.5% shipping<br/>+ 8% VAT/duties + 5% contingency
    V->>K: if over budget: full package + overspend
    K-->>V: revised items + messages to specific agents
    B-->>V: control package, scored by the SAME validators
    V-->>U: plan + who→to event dialogue + measured comparison
```

### Task decomposition & role assignment
The **Coordinator** call returns a bespoke team for *this* brief: per-agent code/name/focus, a concrete Alibaba search query, and a **share of the budget** (shares normalised server-side). Supplier-verification and Critic agents are appended with fixed roles.

### Live sourcing with verified links
Each specialist runs `enable_search: true, search_options: { forced_search, enable_source }` — Qwen performs a real web search and the API returns the **actual result URLs** it saw. The planner enforces: *a cited link survives only if it appeared in that agent's own search results and is on alibaba.com*. Verified lines are labelled **“Live Alibaba listing”**; everything else is downgraded to a labelled estimate. No displayed link can be fabricated.

### Dialogue, disagreement, conflict resolution
Every event is `who → to` dialogue, replayed in the console and acted out in 3D:
- **Supplier vetoes** — cited URLs not present in the search results are rejected on-screen.
- **Budget negotiation** — a specialist that overshoots its share requests more; the Coordinator reallocates *real* headroom from an underspender, or refuses and escalates to the Critic.
- **Critic revision** — over-budget packages are revised; the Critic messages the specific agents whose lines it cut. Revision passes may only reuse URLs that survived the sourcing round.

### Measured efficiency vs single agent
A solo Qwen agent with **identical tools** runs concurrently as a control. Both packages are scored by the **same deterministic validators**: verified links, item coverage, landed-cost budget validity, wall-clock seconds — plus the measured parallel-sourcing speed-up (Σ specialist durations ÷ wall time). The results page shows the live scorecard; nothing is scripted.

### Deterministic core (the LLM never does arithmetic)
Landed cost (shipping, VAT/duties, contingency), budget validation, share normalisation, URL verification, and negotiation arithmetic are plain code in `planner.js` — auditable and un-hallucinatable.

## Qwen Cloud API usage

| Capability | Model | Where |
|---|---|---|
| Role-prompted JSON planning (Coordinator, Critic) | `qwen3.7-plus`, `response_format: json_object` | `qwen.js: chatJSON` |
| **Live web search with cited sources** (specialists, control) | `qwen3.7-plus` + `enable_search`/`forced_search`/`enable_source` | `qwen.js: chatJSONWithSearch` |
| Voice briefs (hold-to-talk, desktop + VR controller) | `qwen3-asr-flash` (browser re-encodes to 22.05 kHz mono WAV) | `qwen.js: transcribe` |
| Concept image of the finished business | `qwen-image-2.0-pro` | `qwen.js: generateImage` |

## 3D / VR ops room (src/xr-room.js)

Three.js scene, lazy-loaded; WebXR `immersive-vr` on Quest-class devices.
- Robots **beam in when they first speak** and *act out* the event stream: the speaker **walks toward whoever it addresses**, faces them, shows a **speech bubble** with the actual message, and fires a message pulse along an agent-to-agent line; the listener nods.
- Between events, agents surface **thought bubbles** (dashed, italic) containing their **genuine Qwen reasoning steps** returned by each specialist call — the swarm's thinking is visualised, not decorated.
- **Interactive**: tap any robot (or point a VR controller and pull the trigger) to inspect it — it turns to you and reports its role, sourced lines and spend. Hold the centre Coordinator to speak your brief.
- Idle agents drift and scan near their stations; all geometry, materials and canvas textures are disposed on exit.

## Error handling & honesty
- Per-call timeouts; specialist failures degrade to explicit events + risks ("live search failed for X"), never a crash.
- The whole live pipeline failing falls back to a clearly-labelled demo catalogue — demo data is never presented as live.
- Payload validation on every route (size caps, WAV header check, text limits); typed `QwenError` → correct HTTP codes.
- Every LLM output is schema-cleaned (type coercion, length caps, enum checks) before it touches the UI.

## Module map

```
server/qwen.js      Qwen Cloud client: chat-JSON, chat-JSON+web-search, ASR, image
server/planner.js   Agent society: coordinator → parallel specialists+control →
                    negotiation → landed cost → critic; scoring & event stream
server/index.js     Express routes, static hosting, error envelope
src/app.js          Views (brief/ops/results), voice recorder, API client
src/xr-room.js      Three.js/WebXR room: bots, dialogue acting, thoughts, inspect
```

## Scaling & productisation
The planner is stateless — horizontal scale is trivial. The specialist layer fans out per category, so richer teams cost latency ≈ the slowest search, not the sum. Marketplace adapters (the Alibaba query + URL-verification policy) are isolated, so adding Amazon Business / Made-in-China is a prompt + hostname-allowlist change. The verified-link policy generalises to any grounded-citation agent product.
