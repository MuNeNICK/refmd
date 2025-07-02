# RefMD Helm Chart

This Helm chart deploys the RefMD application on a Kubernetes cluster.

## Prerequisites

- Kubernetes 1.19+
- Helm 3.2.0+
- PV provisioner support in the underlying infrastructure

## Installing the Chart

To install the chart with the release name `refmd`:

```bash
helm repo add bitnami https://charts.bitnami.com/bitnami
helm dependency update ./helm/refmd
helm install refmd ./helm/refmd
```

## Uninstalling the Chart

To uninstall/delete the `refmd` deployment:

```bash
helm delete refmd
```

## Important Configuration Notes

### URL Configuration

The Helm chart automatically configures URLs based on your deployment method. The frontend application runs in the user's browser and needs to access the API directly.

#### Automatic URL Detection

The chart automatically determines the correct URLs based on:

1. **If `global.externalUrl` is set**: Uses this URL for all services
2. **If Ingress is enabled**: Uses the first host from the Ingress configuration
3. **Otherwise**: Uses localhost URLs (suitable for port-forwarding)

#### Configuration Examples

##### For Local Development (with port-forward):
```bash
# Default values work out of the box
helm install refmd ./helm/refmd

# Then port-forward the services
kubectl port-forward svc/refmd-api 8888:8888
kubectl port-forward svc/refmd-app 3000:3000
```

##### For Production (simple):
```yaml
# Just set your domain - everything else is automatic!
global:
  externalUrl: "https://refmd.example.com"

ingress:
  enabled: true
  hosts:
    - host: refmd.example.com
```

##### For Production (detailed):
```yaml
global:
  externalUrl: "https://refmd.example.com"

api:
  config:
    jwtSecret: "your-secure-secret"

postgresql:
  auth:
    password: "strong-password"

ingress:
  enabled: true
  className: "nginx"
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
  hosts:
    - host: refmd.example.com
      paths:
        - path: /
          pathType: Prefix
          service: app
        - path: /api
          pathType: Prefix
          service: api
  tls:
    - secretName: refmd-tls
      hosts:
        - refmd.example.com
```

##### For NodePort/LoadBalancer Service:
```yaml
# First, deploy with LoadBalancer services
api:
  service:
    type: LoadBalancer

app:
  service:
    type: LoadBalancer

# After getting the external IPs, update the configuration
global:
  externalUrl: "http://<EXTERNAL-IP>:3000"
```

##### For Separate API and App URLs:
```yaml
# When API and App run on different ports or domains
global:
  externalUrl: "https://app.refmd.com"
  separateUrls:
    enabled: true
    apiUrl: "https://api.refmd.com/api"
    socketUrl: "wss://api.refmd.com"

# Or for port-forwarding development
global:
  externalUrl: "http://172.31.100.11:3000"
  separateUrls:
    enabled: true
    apiUrl: "http://172.31.100.11:8888/api"
    socketUrl: "http://172.31.100.11:8888"
```

## Configuration

The following table lists the configurable parameters of the RefMD chart and their default values.

### Global parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `global.externalUrl` | External URL for the application | `""` |
| `global.separateUrls.enabled` | Enable separate URLs for API and WebSocket | `false` |
| `global.separateUrls.apiUrl` | API endpoint URL when separateUrls is enabled | `""` |
| `global.separateUrls.socketUrl` | WebSocket endpoint URL when separateUrls is enabled | `""` |
| `replicaCount` | Number of replicas | `1` |
| `image.pullPolicy` | Image pull policy | `IfNotPresent` |
| `nameOverride` | String to partially override refmd.fullname | `""` |
| `fullnameOverride` | String to fully override refmd.fullname | `""` |

### PostgreSQL parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `postgresql.enabled` | Enable PostgreSQL | `true` |
| `postgresql.auth.database` | PostgreSQL database | `refmd` |
| `postgresql.auth.username` | PostgreSQL username | `refmd` |
| `postgresql.auth.password` | PostgreSQL password | `refmd` |
| `postgresql.primary.persistence.enabled` | Enable persistence | `true` |
| `postgresql.primary.persistence.size` | PVC size | `8Gi` |

### API parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `service.api.type` | API service type | `ClusterIP` |
| `service.api.port` | API service port | `8888` |
| `service.app.type` | App service type | `ClusterIP` |
| `service.app.port` | App service port | `3000` |
| `refmd.api.jwtSecret` | JWT secret key | `dev-secret-key-change-in-production` |
| `refmd.api.signupEnabled` | Enable user signup | `"true"` |
| `api.image.repository` | API image repository | `ghcr.io/munenick/refmd-api` |
| `api.image.tag` | API image tag | `latest` |
| `api.replicaCount` | Number of API replicas | `1` |
| `api.persistence.enabled` | Enable persistence for uploads | `true` |
| `api.persistence.size` | PVC size for uploads | `10Gi` |

### App (Frontend) parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `refmd.app.signupEnabled` | Enable signup in frontend | `"true"` |
| `app.image.repository` | App image repository | `ghcr.io/munenick/refmd-app` |
| `app.image.tag` | App image tag | `latest` |
| `app.replicaCount` | Number of app replicas | `1` |

### Ingress parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `ingress.enabled` | Enable ingress | `false` |
| `ingress.className` | Ingress class name | `""` |
| `ingress.hosts[0].host` | Hostname | `refmd.local` |
| `ingress.tls` | TLS configuration | `[]` |

## Production Deployment Example

For production deployment, create a custom values file:

```yaml
# values-prod.yaml
global:
  externalUrl: "https://refmd.example.com"

refmd:
  api:
    jwtSecret: "your-secure-secret-key"

api:
  replicaCount: 2
  persistence:
    size: 50Gi

app:
  replicaCount: 2

postgresql:
  auth:
    password: "strong-password-here"
  primary:
    persistence:
      size: 20Gi

ingress:
  enabled: true
  className: "nginx"
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
  hosts:
    - host: refmd.example.com
  tls:
    - secretName: refmd-tls
      hosts:
        - refmd.example.com
```

Then deploy with:
```bash
helm install refmd ./helm/refmd -f values-prod.yaml
```