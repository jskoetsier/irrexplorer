---
name: deploy-irrexplorer
description: Use when deploying irrexplorer frontend or backend changes to Rancher/Kubernetes on the internal cluster at 10.15.19.50
---

# Deploy IRRExplorer to Rancher

## Overview

Irrexplorer runs on an RKE2 Rancher cluster. Deployment is manual: rsync source to server, build Docker image, push to local registry, helm upgrade.

## Key Details

| Item | Value |
|------|-------|
| Server | `root@10.15.19.50` |
| Registry | `10.15.19.50:30500` |
| KUBECONFIG | `/etc/rancher/rke2/rke2.yaml` |
| kubectl | `/var/lib/rancher/rke2/bin/kubectl` |
| Helm release | `irrexplorer` (namespace: `irrexplorer`) |
| Git remote | `ssh://onedev.int.koetsier.org/irrexplorer.git` |
| Rancher UI | `https://rancher.int.koetsier.org` (API token may expire — use SSH instead) |

## Deploy Steps

### 1. Verify build locally
```bash
# Frontend
npm run build --prefix frontend

# Go Backend
cd go-backend && go build ./...
```

### 2. Commit and push to git
```bash
git add <files>
git commit -m "..."
git push origin main
# Note the short commit hash, e.g. 2b04ecb
```

### 3. Rsync to server
```bash
rsync -av --exclude='.git' --exclude='node_modules' --exclude='frontend/build' \
  --exclude='.gomodcache' --exclude='output' \
  /path/to/irrexplorer/ root@10.15.19.50:/tmp/irrexplorer-deploy-{COMMIT}/
```

### 4. Build Docker image on server

#### Frontend:
```bash
ssh root@10.15.19.50 "cd /tmp/irrexplorer-deploy-{COMMIT} && \
  docker build -f Dockerfile.frontend \
  -t 10.15.19.50:30500/irrexplorer/frontend:{COMMIT}-{description} . 2>&1"
```

#### Go Backend:
```bash
ssh root@10.15.19.50 "cd /tmp/irrexplorer-deploy-{COMMIT} && \
  docker build -f Dockerfile.go-backend \
  -t 10.15.19.50:30500/irrexplorer/go-backend:{COMMIT}-{description} . 2>&1"
```

Tag format: `{short-commit}-{short-description}` e.g. `2b04ecb-badge1`

### 5. Push image to registry

#### Frontend:
```bash
ssh root@10.15.19.50 "docker push 10.15.19.50:30500/irrexplorer/frontend:{TAG}"
```

#### Go Backend:
```bash
ssh root@10.15.19.50 "docker push 10.15.19.50:30500/irrexplorer/go-backend:{TAG}"
```

### 6. Helm upgrade

#### Frontend only:
```bash
ssh root@10.15.19.50 "export KUBECONFIG=/etc/rancher/rke2/rke2.yaml && \
  helm upgrade irrexplorer /tmp/irrexplorer-deploy-{COMMIT}/charts/irrexplorer \
  -n irrexplorer --reuse-values \
  --set frontend.image.tag={TAG}"
```

#### Go Backend only:
```bash
ssh root@10.15.19.50 "export KUBECONFIG=/etc/rancher/rke2/rke2.yaml && \
  helm upgrade irrexplorer /tmp/irrexplorer-deploy-{COMMIT}/charts/irrexplorer \
  -n irrexplorer --reuse-values \
  --set goBackend.image.tag={TAG}"
```

#### Both:
```bash
ssh root@10.15.19.50 "export KUBECONFIG=/etc/rancher/rke2/rke2.yaml && \
  helm upgrade irrexplorer /tmp/irrexplorer-deploy-{COMMIT}/charts/irrexplorer \
  -n irrexplorer --reuse-values \
  --set frontend.image.tag={FRONTEND_TAG} \
  --set goBackend.image.tag={BACKEND_TAG}"
```

### 7. Verify rollout

#### Frontend:
```bash
ssh root@10.15.19.50 "export KUBECONFIG=/etc/rancher/rke2/rke2.yaml && \
  /var/lib/rancher/rke2/bin/kubectl rollout status \
  deployment/irrexplorer-frontend -n irrexplorer"
```

#### Go Backend:
```bash
ssh root@10.15.19.50 "export KUBECONFIG=/etc/rancher/rke2/rke2.yaml && \
  /var/lib/rancher/rke2/bin/kubectl rollout status \
  deployment/irrexplorer-go-backend -n irrexplorer"
```

## Check Current Deployment

```bash
# Current image tags in use
ssh root@10.15.19.50 "export KUBECONFIG=/etc/rancher/rke2/rke2.yaml && \
  helm get values irrexplorer -n irrexplorer"

# List built images
ssh root@10.15.19.50 "docker images | grep irrexplorer"
```

## Common Mistakes

- **Rancher API 401**: The token in `rancher-api.txt` expires. Use SSH instead.
- **kubectl not found**: Use full path `/var/lib/rancher/rke2/bin/kubectl`
- **Build fails with missing files**: rsync may not have completed — verify files before building
- **`helm` needs KUBECONFIG**: Always `export KUBECONFIG=/etc/rancher/rke2/rke2.yaml` first
