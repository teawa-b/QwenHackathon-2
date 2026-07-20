# SupplySwarm — Devpost submission pack

Last verified against the live competition page and official rules on 20 July 2026. **Do not press the final Devpost submit button until every item in the final checklist is complete.**

## Core details

**Project name**  
SupplySwarm

**Track**  
Track 3: Agent Society

**Tagline / elevator pitch**  
A procurement department formed on demand: Qwen agents divide a business brief, search Alibaba live, negotiate one shared budget, and deliver a verified launch plan in VR and on your phone.

**Repository**  
https://github.com/teawa-b/QwenHackathon-2

**Public demo**  
https://qwenhackathon-2-production.up.railway.app

**Alibaba Cloud deployment proof**  
https://github.com/teawa-b/QwenHackathon-2/blob/main/docs/ALIBABA_CLOUD_DEPLOYMENT.md

**Architecture diagram and technical detail**  
https://github.com/teawa-b/QwenHackathon-2/blob/main/docs/ARCHITECTURE.md

**Video**  
`PENDING — public YouTube, Vimeo, or Youku URL; must be under 3:00`

**Built with**  
Qwen Cloud, qwen3.7-plus, qwen3-asr-flash, qwen-image-2.0-pro, DashScope, Alibaba Cloud, Node.js, Express, WebSockets, Three.js, WebXR, Vite, JavaScript, Docker

## Short description

SupplySwarm turns one sentence—such as “I want to open a small VR training studio in Manchester with a £10,000 equipment budget”—into an evidence-linked procurement plan. A Coordinator creates a specialist team for that exact brief. The specialists search Alibaba in parallel, challenge questionable links, negotiate over one shared budget, and hand the result to a Critic before anything is approved. The whole process can be watched in a browser, inside a VR/AR operations room, or live from a paired phone.

## Inspiration

I built SupplySwarm because sourcing equipment for a new business is rarely just a search problem. You have to split the job into categories, compare options, keep everyone inside one budget, catch unreliable evidence, and make trade-offs when priorities conflict. A single chatbot can produce a list, but it does not naturally show that process. I wanted to make the collaboration visible: who is responsible for what, where the agents disagree, why a decision changes, and whether the swarm actually performs better than one agent working alone.

## What it does

The user gives SupplySwarm a business idea, location, team size, and budget by typing or speaking to the Coordinator robot. The Coordinator designs a bespoke team and assigns each specialist a role, Alibaba search query, and share of the budget. Specialists then run separate Qwen calls with live web search in parallel.

The agents do not simply merge their first answers. A Supplier agent rejects cited URLs that were not present in the real search results. If a specialist overspends its share, that agent makes its own case to the Coordinator in one Qwen call; the Coordinator rules on the request in a separate call. Deterministic code clamps any agreed transfer to real unspent headroom, calculates shipping, VAT/duties and contingency, and checks the final ceiling. A Critic revises over-budget packages or upgrades heavily underspent ones.

Every live run also sends the identical brief and tools to one solo Qwen agent. Both outputs are scored by the same validators, so the results page shows a measured comparison rather than a scripted claim. In a fresh live verification run on 20 July, six agents produced a £9,753 budget-valid plan and parallel execution measured a 3.4× speed-up; the solo control returned an £8,066 budget-valid package.

SupplySwarm also remembers completed missions per role. Agents recall factual details such as previous spend, vetoed links and negotiated transfers on relevant future briefs. The memory layer uses deterministic keyword matching, so recall cannot invent a past event.

## How I built it

The backend is a Node.js and Express service packaged as a Docker container for Alibaba Cloud ECS or Simple Application Server. `planner.js` orchestrates the Agent Society pipeline: deterministic memory recall, Coordinator planning, parallel specialist calls, a parallel solo-agent control, negotiation, validation, Critic revision and mission recording. `qwen.js` connects directly to Qwen Cloud / DashScope for JSON planning, grounded live search, speech recognition and concept-image generation.

The frontend is a Vite application with a Three.js/WebXR operations room. Agent events are replayed as robot movement, speech bubbles, thought bubbles and message pulses. A WebSocket session hub creates a five-letter pairing code so a phone can follow the same live run, inspect agents, send a request to a specific role and download the final PDF.

The arithmetic and evidence checks deliberately sit outside the model. Landed costs, budget validity, share normalisation, source allow-lists and negotiation limits are ordinary auditable code. That lets the agents reason and argue while keeping the final numbers deterministic.

## Challenges I ran into

The hardest part was making disagreement genuine without letting it break the budget. If every conflict were resolved by fixed rules, it would not demonstrate agent negotiation. If the models controlled the numbers directly, the result could drift or hallucinate. I solved that by separating the conversation from the authority: agents make and judge the case in separate Qwen calls, then deterministic code enforces the real financial limits.

Grounding marketplace links was another challenge. A plausible-looking URL is not enough, so SupplySwarm keeps the actual search sources returned to each specialist and removes any citation the agent did not really see. In VR, I also had to balance readable world-space UI with natural head movement and controller-ray interaction.

## Accomplishments I am proud of

- The agents have distinct responsibilities and visibly talk to one another instead of acting like a hidden prompt chain.
- Budget disputes are argued by the models but constrained by deterministic accounting.
- Every live run includes a fair solo-agent control using the same brief, search tools and validators.
- Per-role memory is factual, inspectable and carried into later missions.
- The same live swarm can be followed in WebXR and from a paired phone, including agent-directed messages and a downloadable PDF.
- The system degrades honestly: without a Qwen key it switches to a clearly labelled demo catalogue rather than pretending the data is live.

## What I learned

Multi-agent systems become much easier to trust when their boundaries are explicit. Qwen is strongest here when each call has a clear role and context, while deterministic code owns validation, arithmetic and permissions. I also learned that “measurable improvement” needs a real control path. Running a solo agent beside the swarm made performance claims part of the product rather than a line in the pitch.

## What is next

The next step is to add more marketplace adapters behind the same evidence policy and move mission memory from a single persistent volume to a queryable managed store. I would also add team-level approval policies so a business can decide which categories are fully autonomous and which require a human checkpoint before the swarm proceeds.

## Testing instructions for judges

1. Open https://qwenhackathon-2-production.up.railway.app in Chrome or a Meta Quest browser.
2. Choose **Use in VR**. Desktop users can drag to orbit; Quest users can enter immersive VR or passthrough AR.
3. Choose **Full autonomy** or **Check in with me**.
4. Enter: `A small VR training studio in Manchester with a £10,000 equipment budget for a two-person team`.
5. In check-in mode, answer the Coordinator's questions or let the agents decide.
6. Watch the bespoke team appear, search in parallel, exchange messages and resolve conflicts.
7. Open **View launch plan** and inspect the evidence labels, landed-cost total, measured single-agent comparison and swarm memory.
8. Optional: open `/connect` on a phone, enter the five-letter code shown in the ops room, and message a specific agent.

No purchases or supplier messages are sent. Linked prices are marketplace observations rather than quotations and should be confirmed with the seller.

## Upload-ready screenshots

The strongest current captures are in the local `output/playwright/` folder:

1. `live-vr-planning-after-checkin.png` — the complete specialist society assembled around the Coordinator.
2. `live-vr-checkin-question.png` — a specialist asking the user a meaningful human-in-the-loop question.
3. `live-vr-checkin-progress.png` — the completed, budget-valid plan inside the VR operations room.
4. `live-vr-choice-picker.png` — Full autonomy versus Check in with me.

## Final checklist

- [x] Public GitHub repository
- [x] MIT license file
- [x] Source code, assets and setup instructions
- [x] Track 3: Agent Society clearly identified
- [x] Task decomposition and distinct agent roles
- [x] Dialogue, disagreement and execution-conflict resolution
- [x] Measured comparison against a solo-agent baseline
- [x] Architecture diagram and detailed architecture document
- [x] Qwen Cloud API integration visible in public code
- [x] Alibaba Cloud deployment code committed to the repository
- [ ] Alibaba Cloud instance live and externally verified
- [ ] Workbench/instance proof screenshot added to the repo
- [ ] Public video URL under three minutes
- [ ] Devpost account signed in and hackathon registration completed
- [ ] Devpost project fields and screenshots saved
- [ ] Final review by Tiwa
- [ ] Final Devpost submission by Tiwa (Codex must not press submit)
