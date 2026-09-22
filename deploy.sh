#!/bin/bash
# ==============================================================================
# SCRIPT DEPLOY UNG DUNG DEV TRONG K8S
# ==============================================================================
# Buoc 1: Build lai Docker Image tu code moi trong /opt/app/dev/crc_app
# Buoc 2: Khoi dong lai Pod trong K8s (crc-dev-deployment)
# ==============================================================================
set -e

if [ -r "/etc/rancher/k3s/k3s.yaml" ]; then
  export KUBECONFIG="/etc/rancher/k3s/k3s.yaml"
elif [ -f "/home/terax/.kube/config" ]; then
  export KUBECONFIG="/home/terax/.kube/config"
fi

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}==================================================================${NC}"
echo -e "${BLUE}  🚀 TRIEN KHAI DEV CODE MOI LEN KUBERNETES (crc-dev-deployment)  ${NC}"
echo -e "${BLUE}==================================================================${NC}"

echo -e "\n📦 ${BLUE}[Buoc 1/2] Build lai Docker Image tu code moi...${NC}"
docker build -t crc-dev-app:latest /opt/app/dev/crc_app
docker build -t crc-web-app:latest /opt/app/dev/crc_app

echo -e "\n📦 [Buoc 1.5] Nap anh Docker vao cache containerd cua K3s..."
docker save crc-dev-app:latest | sudo /usr/local/bin/k3s ctr -n k8s.io images import -
docker save crc-web-app:latest | sudo /usr/local/bin/k3s ctr -n k8s.io images import -

echo -e "\n🚀 ${BLUE}[Buoc 2/2] Ap dung cau hinh k8s va khoi dong lai ca 2 Pod...${NC}"
kubectl apply -f /opt/app/dev/crc_app/k8s-dev-cms.yaml
kubectl rollout restart deployment/crc-dev-deployment
kubectl rollout status deployment/crc-dev-deployment

kubectl rollout restart deployment/crc-app-deployment || true
kubectl rollout status deployment/crc-app-deployment || true

echo -e "\n${GREEN}✅ HOAN TAT: Da build va rollout restart ca 2 deployment (Port 5221 & Port 5222 / dev.terax.ai) thanh cong!${NC}"

