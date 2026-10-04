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

echo "=== [1/3] Building Docker image for terax_ver2 ==="
docker build -t terax-ver2-app:latest /opt/app/terax_ver2

echo "=== [2/3] Importing image into k3s containerd ==="
docker save terax-ver2-app:latest | sudo /usr/local/bin/k3s ctr -n k8s.io images import -

echo "=== [3/3] Applying k8s-dev2.yaml and rolling out ==="
kubectl apply -f /opt/app/terax_ver2/k8s-dev2.yaml
kubectl rollout restart deployment/crc-dev2-deployment || true
kubectl rollout status deployment/crc-dev2-deployment

echo "=== Done! ==="

