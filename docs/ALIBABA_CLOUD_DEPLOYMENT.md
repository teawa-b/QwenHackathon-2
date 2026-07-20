# Alibaba Cloud deployment proof

SupplySwarm's production backend is packaged for **Alibaba Cloud ECS / Simple Application Server** in [`deploy/alibaba-cloud/docker-compose.yml`](../deploy/alibaba-cloud/docker-compose.yml). The container runs the complete Express API, WebSocket phone companion, frontend, persistent agent memory, and Qwen Cloud client.

## Public deployment

The Alibaba Cloud instance has been provisioned and is running. The application endpoint remains marked pending until the container is deployed and independently checked from outside the instance.

| Evidence | Value |
|---|---|
| Alibaba Cloud service | Simple Application Server (Ubuntu 24.04, 2 vCPU, 2 GiB) |
| Region | Singapore (`ap-southeast-1`) |
| Public health endpoint | `PENDING` |
| Deployed commit | `PENDING` |
| Workbench proof screenshot | `PENDING` |

## Code evidence

- [`deploy/alibaba-cloud/docker-compose.yml`](../deploy/alibaba-cloud/docker-compose.yml) — Alibaba-specific production runtime, region and provider metadata, persistent memory volume, and health check.
- [`deploy/alibaba-cloud/bootstrap.sh`](../deploy/alibaba-cloud/bootstrap.sh) — idempotent Ubuntu bootstrap used by Alibaba Cloud Command Assistant or Workbench.
- [`Dockerfile`](../Dockerfile) — reproducible multi-stage Node.js production image.
- [`server/qwen.js`](../server/qwen.js) — direct Qwen Cloud / DashScope API integration for planning, grounded search, ASR, and image generation.
- [`server/index.js`](../server/index.js) — public deployment metadata and health route plus the agent API and WebSocket-backed application server.

## Verification response

The Alibaba instance sets `DEPLOYMENT_PROVIDER`, `DEPLOYMENT_REGION`, and `DEPLOYMENT_COMMIT`. `/api/health` exposes those non-secret values beside the live Qwen model IDs, making the deployed runtime easy for judges to verify without revealing credentials.

This page intentionally does not claim a completed Alibaba deployment until the endpoint and Workbench screenshot have been checked from outside the instance.
