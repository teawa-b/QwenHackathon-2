# Alibaba Cloud deployment

This is the production deployment bundle for the Qwen Cloud hackathon. It runs the complete SupplySwarm application—Express API, WebSocket companion service, Vite frontend, persistent agent memory, and Qwen Cloud integration—in one Docker container on **Alibaba Cloud ECS or Simple Application Server (SAS/SWAS)**.

The judge-facing demo may remain on its existing HTTPS URL, but the hackathon's required backend deployment is independently verifiable on Alibaba Cloud through:

- this Alibaba-specific Docker Compose manifest;
- the public `/api/health` response, which reports `deployment.provider`, `region`, and `commit` from the Alibaba instance environment;
- the Qwen Cloud API implementation in [`server/qwen.js`](../../server/qwen.js); and
- an Alibaba Cloud Workbench/instance screenshot recorded in [`docs/ALIBABA_CLOUD_DEPLOYMENT.md`](../../docs/ALIBABA_CLOUD_DEPLOYMENT.md).

## Recommended service

Use **Simple Application Server** with Ubuntu 24.04 for the fastest setup. A small CPU instance is sufficient because inference runs through Qwen Cloud APIs; no GPU is required.

1. Create an Alibaba Cloud Simple Application Server using Ubuntu 24.04.
2. Open inbound HTTP port `80`. Restrict SSH port `22` to your own IP.
3. Connect through Workbench.
4. Run the idempotent bootstrap script:

```bash
curl -fsSL https://raw.githubusercontent.com/teawa-b/QwenHackathon-2/main/deploy/alibaba-cloud/bootstrap.sh | sudo bash
```

Alternatively, deploy manually:

```bash
git clone https://github.com/teawa-b/QwenHackathon-2.git
cd QwenHackathon-2/deploy/alibaba-cloud
cp .env.example .env
nano .env
docker compose up -d --build
docker compose ps
curl http://127.0.0.1/api/health
```

Set the real `DASHSCOPE_API_KEY`, the instance region, and the deployed Git commit in `.env`. Do not paste the key into screenshots, commits, logs, or the Devpost form.

When `DASHSCOPE_API_KEY` is omitted, the Alibaba-hosted application still starts in its clearly labelled demo mode. To run live Qwen calls from this instance, export the key only for the bootstrap command (or add it directly to the server-side `.env`) and redeploy; never commit it.

## Public verification

After deployment, visit:

```text
http://ALIBABA_PUBLIC_IP/api/health
```

A valid response identifies Alibaba Cloud and confirms live Qwen models without exposing credentials:

```json
{
  "live": true,
  "models": {
    "text": "qwen3.7-plus",
    "asr": "qwen3-asr-flash",
    "image": "qwen-image-2.0-pro"
  },
  "deployment": {
    "provider": "Alibaba Cloud ECS/SAS",
    "region": "ap-southeast-1",
    "commit": "<git commit>"
  }
}
```

## Proof capture

Take one screenshot in Alibaba Cloud Workbench showing:

```bash
hostname
docker compose ps
curl http://127.0.0.1/api/health
```

Keep the Alibaba console chrome visible enough to identify the service and region, but make sure no API key, password, access key, or private IP details are exposed.
