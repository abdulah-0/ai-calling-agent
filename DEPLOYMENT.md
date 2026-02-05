# AI Calling Agent - Deployment Guide

## Docker Deployment

### Build Image
```bash
docker build -t ai-calling-agent .
```

### Run Container
```bash
docker run -d \
  --name ai-calling-agent \
  -p 3000:3000 \
  -e TELNYX_API_KEY=your_key \
  -e TELNYX_CONNECTION_ID=your_connection_id \
  -e DEEPGRAM_API_KEY=your_key \
  -e OPENAI_API_KEY=your_key \
  -e ELEVENLABS_API_KEY=your_key \
  -e REDIS_URL=redis://redis:6379 \
  --link redis:redis \
  ai-calling-agent
```

## Docker Compose

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    command: redis-server --appendonly yes

  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - REDIS_URL=redis://redis:6379
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - TELNYX_API_KEY=${TELNYX_API_KEY}
      - TELNYX_CONNECTION_ID=${TELNYX_CONNECTION_ID}
      - TELNYX_PHONE_NUMBER=${TELNYX_PHONE_NUMBER}
      - DEEPGRAM_API_KEY=${DEEPGRAM_API_KEY}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - ELEVENLABS_API_KEY=${ELEVENLABS_API_KEY}
      - ELEVENLABS_VOICE_ID=${ELEVENLABS_VOICE_ID}
      - DOMAIN=${DOMAIN}
    depends_on:
      - redis
    restart: unless-stopped

volumes:
  redis-data:
```

Run with:
```bash
docker-compose up -d
```

## Kubernetes Deployment

### 1. Create ConfigMap

`k8s/configmap.yaml`:
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: ai-agent-config
data:
  PORT: "3000"
  NODE_ENV: "production"
  REDIS_HOST: "redis-service"
  REDIS_PORT: "6379"
```

### 2. Create Secrets

```bash
kubectl create secret generic ai-agent-secrets \
  --from-literal=TELNYX_API_KEY=your_key \
  --from-literal=TELNYX_CONNECTION_ID=your_id \
  --from-literal=DEEPGRAM_API_KEY=your_key \
  --from-literal=OPENAI_API_KEY=your_key \
  --from-literal=ELEVENLABS_API_KEY=your_key
```

### 3. Deploy Redis

`k8s/redis-deployment.yaml`:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis
spec:
  replicas: 1
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      containers:
      - name: redis
        image: redis:7-alpine
        ports:
        - containerPort: 6379
        volumeMounts:
        - name: redis-storage
          mountPath: /data
      volumes:
      - name: redis-storage
        persistentVolumeClaim:
          claimName: redis-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: redis-service
spec:
  selector:
    app: redis
  ports:
  - port: 6379
    targetPort: 6379
```

### 4. Deploy Application

`k8s/app-deployment.yaml`:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ai-calling-agent
spec:
  replicas: 3
  selector:
    matchLabels:
      app: ai-calling-agent
  template:
    metadata:
      labels:
        app: ai-calling-agent
    spec:
      containers:
      - name: ai-calling-agent
        image: your-registry/ai-calling-agent:latest
        ports:
        - containerPort: 3000
        envFrom:
        - configMapRef:
            name: ai-agent-config
        - secretRef:
            name: ai-agent-secrets
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
---
apiVersion: v1
kind: Service
metadata:
  name: ai-agent-service
spec:
  type: LoadBalancer
  selector:
    app: ai-calling-agent
  ports:
  - port: 80
    targetPort: 3000
```

### 5. Horizontal Pod Autoscaler

`k8s/hpa.yaml`:
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: ai-agent-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: ai-calling-agent
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

### Deploy All
```bash
kubectl apply -f k8s/
```

## Scaling Considerations

### For 100 Concurrent Calls
- **Replicas**: 5-10 pods
- **CPU**: 2 cores per pod
- **Memory**: 2GB per pod
- **Redis**: Single instance with persistence

### For 500+ Concurrent Calls
- **Replicas**: 20-30 pods
- **Redis**: Cluster mode (3 masters, 3 replicas)
- **Load Balancer**: Nginx/HAProxy with WebSocket support
- **Monitoring**: Prometheus + Grafana

## Monitoring

### Prometheus Metrics

Add to `src/index.ts`:
```typescript
import promClient from 'prom-client';

const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });

const callsTotal = new promClient.Counter({
  name: 'calls_total',
  help: 'Total number of calls',
  registers: [register]
});

fastify.get('/metrics', async (req, reply) => {
  reply.type('text/plain').send(await register.metrics());
});
```

### Health Checks
```typescript
fastify.get('/health', async (req, reply) => {
  return { 
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: Date.now()
  };
});
```

## Production Checklist

- [ ] Environment variables secured
- [ ] Redis persistence enabled
- [ ] SSL/TLS certificates configured
- [ ] Rate limiting implemented
- [ ] Logging configured (Winston/Pino)
- [ ] Error tracking (Sentry)
- [ ] Monitoring (Prometheus/Grafana)
- [ ] Backup strategy for call logs
- [ ] CI/CD pipeline set up
- [ ] Load testing completed
