# SupplySwarm

SupplySwarm is a mobile-first hackathon vertical slice that turns a business brief and budget into a transparent procurement package. It demonstrates dynamic specialist agents, visible collaboration, deterministic landed-cost calculations, a critic/revision loop, evidence labels, and human approval gates.

## 3D / VR operations room

"Enter 3D Ops Room · VR" on the home screen opens a Three.js operations room: the coordinator robot stands at the centre, specialist robots beam in around it as the swarm works, data pulses travel along the links, and a floating status board streams live agent events. On WebXR-capable devices (e.g. Meta Quest browser) an **Enter VR** button appears and launches an immersive `immersive-vr` session at native framebuffer resolution; on desktop and mobile you can orbit and zoom the same scene. Three.js is lazy-loaded only when the room is entered, so the base app stays lightweight.

## Run locally

```powershell
npm.cmd install
npm.cmd run dev
```

## Build

```powershell
npm.cmd run build
```

## Data mode

The hosted build intentionally uses a labelled demo catalogue. It does not claim live Alibaba results or call suppliers. Qwen Cloud, Alibaba Procurement MCP, realtime voice, generated concept imagery, notifications, and persistence require server-side credentials and services in the full production architecture.
