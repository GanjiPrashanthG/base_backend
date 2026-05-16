# ALB target group health check (mayday-api)

Use this when ECS tasks are **running** but the target group shows **Unhealthy** (e.g. `Request timed out` on `10.0.x.x:3000`).

## App already exposes the right endpoints

No code change is required for a basic liveness probe:

| Path | Response |
|------|----------|
| `GET /health` | `200` — `{ "ok": true }` |
| `GET /` | `200` — service JSON with links |

Implementation: [`src/routes/health.ts`](../src/routes/health.ts), [`src/routes/root.ts`](../src/routes/root.ts).

## 1. Fix target group health check (console)

**Target groups** → your TG (e.g. `backeked-cluster-tg`) → **Health checks** → **Edit**:

| Field | Value |
|-------|--------|
| Protocol | HTTP |
| Path | `/health` |
| Port | Traffic port (target registered on **3000**) |
| Success codes | `200` |
| Timeout | 5 s (default is fine) |
| Interval | 30 s |
| Healthy threshold | 2–5 |
| Unhealthy threshold | 2 |

Save. Wait one–two intervals; status should move to **Healthy** if networking and the process are correct.

**Note:** `GET /` also returns `200` for this API. If you still see **Request timed out** after switching to `/health`, the path was not the root cause.

## 2. "Request timed out" — check security groups first

A **timeout** means the ALB never got an HTTP response in time (often **no TCP connection**). Typical fixes:

### Task security group (Fargate ENI)

**Inbound rule required:**

| Type | Port | Source |
|------|------|--------|
| Custom TCP | **3000** | **ALB security group** (sg-xxx), not `0.0.0.0/0` |

### ALB security group

- Inbound: `80` / `443` from clients (or your CIDR).
- Outbound: default “all traffic” is usually fine.

### Wrong pattern that causes timeout

- Task SG allows **80** but app listens on **3000**.
- Task SG has no inbound from **ALB SG**.
- Target registered on wrong port (must match container `PORT`, default **3000**).

## 3. Task must listen on all interfaces

In the ECS task definition (or Secrets/env), set:

```env
HOST=0.0.0.0
PORT=3000
```

If `HOST` is missing, the app defaults to `127.0.0.1` and the ALB cannot reach the task IP. See [`deploy/aws-ecs.env.example`](aws-ecs.env.example).

Confirm in CloudWatch logs after deploy:

```text
server listening ... "host":"0.0.0.0","port":3000
```

## 4. ECS service / target group alignment

| Setting | Expected |
|---------|----------|
| Container port | **3000** |
| Target group type | **IP** (Fargate awsvpc) |
| Target group port | **3000** (or “traffic port” with targets on 3000) |
| Health check port | **Traffic port** |
| Subnets | Tasks in **private** subnets; ALB in **public** subnets (same VPC) |

Target group header may show **HTTP : 80** for the listener; registered targets should still show port **3000**.

## 5. If the app crashes on startup

Timeout can also occur if nothing is listening. Check:

1. **ECS** → cluster → service → **Tasks** → stopped task **Reason**.
2. **CloudWatch** log group for the task (Mongo URL, env validation, etc.).
3. Run locally: `docker build -t mayday-api . && docker run --rm -p 3000:3000 -e HOST=0.0.0.0 -e MONGODB_ENABLED=0 mayday-api` then `curl -f http://127.0.0.1:3000/health`.

## 6. `/health` vs `/health/ready`

| Path | Use on ALB when |
|------|------------------|
| `/health` | Liveness only (process up). **Recommended** for target group. |
| `/health/ready` | You want the target **unhealthy** if MongoDB ping fails (`503`). Only use if Mongo is stable in that environment. |

## Quick checklist

- [ ] Target group health path = `/health`, success codes = `200`
- [ ] Task SG: TCP **3000** from **ALB SG**
- [ ] `HOST=0.0.0.0`, `PORT=3000` on the task
- [ ] Container port mapping **3000** → target group
- [ ] CloudWatch: task running and log shows `server listening` on `0.0.0.0:3000`
