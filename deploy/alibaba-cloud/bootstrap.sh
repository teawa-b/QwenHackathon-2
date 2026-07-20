#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${SUPPLYSWARM_APP_DIR:-/opt/supplyswarm}"
REPOSITORY="https://github.com/teawa-b/QwenHackathon-2.git"
BRANCH="${SUPPLYSWARM_BRANCH:-main}"
REGION="${DEPLOYMENT_REGION:-ap-southeast-1}"
PROVIDER="${DEPLOYMENT_PROVIDER:-Alibaba Cloud Simple Application Server}"

export DEBIAN_FRONTEND=noninteractive

apt-get update
apt-get install -y ca-certificates curl git docker.io

if ! docker compose version >/dev/null 2>&1; then
  if ! apt-get install -y docker-compose-v2; then
    apt-get install -y docker-compose
  fi
fi

systemctl enable --now docker

if [[ -d "$APP_DIR/.git" ]]; then
  git -C "$APP_DIR" fetch --depth 1 origin "$BRANCH"
  git -C "$APP_DIR" checkout -B "$BRANCH" "origin/$BRANCH"
else
  rm -rf "$APP_DIR"
  git clone --depth 1 --branch "$BRANCH" "$REPOSITORY" "$APP_DIR"
fi

COMMIT="$(git -C "$APP_DIR" rev-parse --short HEAD)"
DEPLOY_DIR="$APP_DIR/deploy/alibaba-cloud"

cat > "$DEPLOY_DIR/.env" <<EOF
DASHSCOPE_API_KEY=${DASHSCOPE_API_KEY:-}
DEPLOYMENT_PROVIDER=$PROVIDER
DEPLOYMENT_REGION=$REGION
DEPLOYMENT_COMMIT=$COMMIT
EOF

cd "$DEPLOY_DIR"

if docker compose version >/dev/null 2>&1; then
  docker compose up -d --build
  docker compose ps
else
  docker-compose up -d --build
  docker-compose ps
fi

for attempt in {1..30}; do
  if curl -fsS http://127.0.0.1/api/health; then
    printf '\nSupplySwarm is healthy on Alibaba Cloud.\n'
    exit 0
  fi
  sleep 2
done

printf 'SupplySwarm did not become healthy within 60 seconds.\n' >&2
exit 1
