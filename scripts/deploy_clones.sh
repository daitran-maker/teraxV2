#!/bin/bash
# ==============================================================================
# SCRIPT DEPLOY FULL APPS (DEV, STABLE, & 15 CLONES) TO KUBERNETES
# ==============================================================================
set -e

export KUBECONFIG="/home/terax/.kube/config"

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}==================================================================${NC}"
echo -e "${BLUE}  🚀 DEPLOYING UPDATED CODE TO ALL TENANT DEPLOYMENTS IN K8S      ${NC}"
echo -e "${BLUE}==================================================================${NC}"

# Define temporary tar files inside the workspace
DEV_TAR="/opt/app/dev/crc_app/scripts/crc-dev-app.tar"
WEB_TAR="/opt/app/dev/crc_app/scripts/crc-web-app.tar"

echo -e "\n📦 ${BLUE}[Step 1/3] Building Docker images for crc_app...${NC}"
docker build -t crc-dev-app:latest /opt/app/dev/crc_app
docker build -t crc-web-app:latest /opt/app/dev/crc_app

echo -e "\n📥 ${BLUE}[Step 2/3] Saving and importing images into k3s containerd...${NC}"
docker save crc-dev-app:latest -o "$DEV_TAR"
docker save crc-web-app:latest -o "$WEB_TAR"

sudo k3s ctr images import "$DEV_TAR"
sudo k3s ctr images import "$WEB_TAR"

rm -f "$DEV_TAR" "$WEB_TAR"

echo -e "\n🚀 ${BLUE}[Step 3/3] Rollout restarting all 17 deployments...${NC}"
deployments=(
  "crc-dev-deployment"
  "crc-app-deployment"
)
for i in $(seq 1 15); do
  deployments+=("terax${i}-deployment")
done

for dep in "${deployments[@]}"; do
  echo "Restarting deployment: $dep..."
  kubectl rollout restart deployment/"$dep"
done

# Wait for rollout of dev and stable
echo "Waiting for rollouts of primary services..."
kubectl rollout status deployment/crc-dev-deployment
kubectl rollout status deployment/crc-app-deployment

echo -e "\n${GREEN}✅ SUCCESS: All tenant apps have been successfully updated and restarted!${NC}"
