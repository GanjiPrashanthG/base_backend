# AWS: VPC → CodePipeline → ECS (Fargate) — step-by-step

This guide assumes you already have a **VPC** (for example `staging-vpc` in `us-east-1`) with **public**, **private**, and **database** subnets, an **Internet Gateway**, and a **NAT Gateway**. It deploys **mayday-api** using the repo **`Dockerfile`** (Node 26, `dist/server.js`).

Adapt names (`staging`, `mayday-api`, regions) to your account.

---

## 0. Prerequisites checklist

| Item | Notes |
|------|--------|
| AWS account + IAM user/role | Admin or enough rights to create VPC endpoints (optional), ECR, ECS, CodeBuild, CodePipeline, ALB, Secrets Manager, CloudWatch Logs |
| Git repository | GitHub (via **CodeStar Connections**) or AWS CodeCommit |
| MongoDB reachable from private subnets | **MongoDB Atlas** (VPC peering / private endpoint), **Amazon DocumentDB**, or **MongoDB on EC**2 in DB subnets — not covered in detail here; you need a **`DATABASE_URL`** compatible with **Prisma Mongo** |
| Local Docker | Used to test `docker build` before pushing |

---

## 1. VPC hygiene (do this before ECS)

1. In **VPC** → your VPC → **Actions** → **Edit VPC settings**.
2. Enable **DNS hostnames** (often required for ALB/ECS and internal AWS endpoints).
3. **Route tables**
   - **Public** subnets: `0.0.0.0/0` → **Internet Gateway**.
   - **Private** subnets (for Fargate tasks): `0.0.0.0/0` → **NAT Gateway** (so tasks can pull from ECR and reach external APIs if needed).
   - **Database** subnets: typically **no** default route to the internet; only paths you intend (e.g. internal only).
4. (Optional) **VPC endpoints** for **ECR (API + DKR)**, **S3**, **CloudWatch Logs** in private subnets reduce NAT traffic and improve reliability.

---

## 2. Amazon ECR (container registry)

1. Open **Amazon ECR** → **Repositories** → **Create repository**.
2. **Repository name**: e.g. `mayday-api` (must match **`IMAGE_REPO_NAME`** in CodeBuild env).
3. **Tag immutability** / **scan on push**: set per your org policy.
4. Note the **URI**: `<account>.dkr.ecr.<region>.amazonaws.com/mayday-api`.

---

## 3. Secrets and configuration (Secrets Manager)

Create secrets (or use **SSM Parameter Store**) for runtime — **never** bake these into the image.

| Secret / parameter | Example purpose |
|--------------------|-----------------|
| `DATABASE_URL` | Prisma Mongo connection string |
| `ADMIN_API_KEY` | If you use admin routes / metrics auth |
| `SENTRY_DSN` | Optional observability |

**ECS task definition** will reference these as **secrets** (valueFrom ARN). Plain non-sensitive env (e.g. `NODE_ENV=production`, `MONGODB_ENABLED=1`, `TRUST_PROXY_HOPS=1`) can be set directly on the task.

**Behind ALB:** set **`TRUST_PROXY_HOPS=1`** (or `2` if traffic passes two proxies) so rate limits and logs see the real client IP.

---

## 4. IAM roles (minimal mental model)

| Role | Used by | Needs (high level) |
|------|---------|---------------------|
| **CodeBuild service role** | CodeBuild | ECR push/pull, logs; optional VPC access if build runs in VPC |
| **CodePipeline service role** | Pipeline | Start CodeBuild, pass artifacts, trigger deploy |
| **ECS task execution role** | Fargate agent | Pull image from ECR, write logs, read secrets from Secrets Manager |
| **ECS task role** | Your app container | Only if the **app** calls AWS APIs (S3, etc.); often not required for mayday-api |

Create roles with AWS-managed policies where possible, then tighten with least privilege.

---

## 5. ECS cluster and task definition (Fargate)

### 5.1 Cluster

1. **ECS** → **Clusters** → **Create cluster** → **Networking only** (Fargate).
2. Name: e.g. `staging-cluster`.

### 5.2 Task definition

1. **Task definitions** → **Create new task definition** → **Fargate**.
2. **Task size**: CPU / memory for Node (e.g. 0.5 vCPU, 1 GB to start; tune with load tests).
3. **Container**
   - **Name**: e.g. `api` — must match **`CONTAINER_NAME`** in [`buildspec.yml`](../buildspec.yml) for the ECS deploy artifact.
   - **Image URI**: paste ECR URI + tag you will push (first deploy can use a tag you push manually, then pipeline owns tags).
   - **Port mappings**: container port **3000** (matches `Dockerfile` / app default).
   - **Environment**: `NODE_ENV`, `PORT=3000`, `MONGODB_ENABLED`, `TRUST_PROXY_HOPS`, etc.
   - **Secrets**: map `DATABASE_URL` (and others) from Secrets Manager ARNs.
4. **Logging**: enable **awslogs** driver → pick/create a **CloudWatch Logs** group.
5. **Network**: choose your **VPC**, **private** subnets, **ECS task security group** (see below).

### 5.3 Security groups (sketch)

| SG | Attached to | Inbound |
|----|----------------|---------|
| **ALB SG** | Application Load Balancer | `443` (and/or `80`) from the internet or your corporate CIDR |
| **Task SG** | Fargate tasks | **3000** from **ALB SG only** |
| **Mongo / DocumentDB SG** | Database | **27017** (or DocumentDB port) from **Task SG** only |

Outbound on task SG: default allow all is common for first setup; tighten later.

---

## 6. Application Load Balancer + target group

1. **EC2** → **Load Balancers** → **Create** → **Application Load Balancer**.
2. **Scheme**: internet-facing; **Subnets**: **public** subnets in two AZs.
3. **Security group**: ALB SG (inbound 443/80).
4. **Target group**: type **IP**, protocol **HTTP**, port **3000**, VPC your staging VPC, health check path **`/health/ready`** (or **`/health`** if you do not want DB in the probe — align with how you run Mongo in that environment).
5. **Listener**: HTTPS (ACM certificate in the same region) recommended; forward to the target group.

Register the **ECS service** with this target group (next step).

---

## 7. ECS service (runs the task behind the ALB)

1. In your cluster → **Services** → **Create**.
2. **Launch type**: Fargate.
3. **Task definition** + **desired count** (e.g. 1 for staging).
4. **VPC**: staging VPC; **Subnets**: **private**; **Security groups**: task SG.
5. **Load balancing**: Application Load Balancer → pick ALB + target group; container **3000** maps to TG.
6. Deploy once; confirm targets **healthy** and you get JSON from `/` or `/health`.

---

## 8. CodeBuild project (build + push to ECR)

1. **CodeBuild** → **Create build project**.
2. **Source**: same provider as your pipeline (e.g. GitHub via CodeStar Connections).
3. **Environment**
   - **Image**: **aws/codebuild/standard:7.0** (or latest standard) with **Privileged** enabled (**required for `docker build`**).
   - **Compute**: small instance is fine to start.
   - **Environment variables** (plain text or parameter store):

     | Name | Example | Purpose |
     |------|---------|---------|
     | `AWS_DEFAULT_REGION` | `us-east-1` | ECR / STS |
     | `IMAGE_REPO_NAME` | `mayday-api` | ECR repository name |
     | `CONTAINER_NAME` | `api` | Must match ECS container name for `imagedefinitions.json` |
     | `IMAGE_TAG` | *(optional)* | Defaults to `CODEBUILD_RESOLVED_SOURCE_VERSION` in [`buildspec.yml`](../buildspec.yml) |

4. **Buildspec**: **Use a buildspec file** → path **`buildspec.yml`** (repo root — already in this repository).
5. **Service role**: CodeBuild role with ECR push and CloudWatch Logs permissions.
6. Run the project manually once; confirm image appears in ECR and build succeeds.

---

## 9. CodePipeline (Source → Build → Deploy)

### 9.1 Source stage

1. **CodePipeline** → **Create pipeline**.
2. **Source provider**: GitHub (CodeStar Connection) or CodeCommit; pick branch (e.g. `main`).

### 9.2 Build stage

1. **Build provider**: AWS CodeBuild → select the project from **§8**.
2. Output artifact: build output containing **`imagedefinitions.json`** (produced by [`buildspec.yml`](../buildspec.yml)).

### 9.3 Deploy stage (ECS standard)

1. **Deploy provider**: **Amazon ECS** → **Amazon ECS standard deployment**.
2. **Cluster** + **Service** from **§7**.
3. **Image definitions file**: `imagedefinitions.json` (artifact from CodeBuild).

**Alternative:** **Amazon ECS (CodeDeploy)** for blue/green — more moving parts (CodeDeploy app/deployment group, second target group). Use when you need controlled traffic shifting.

---

## 10. Database and `migrate-mongo`

- **`prisma db push` / schema**: usually part of **release process** (CI or a one-off job), not necessarily every pipeline run — your team’s choice.
- **`migrate-mongo`**: run from **CodeBuild** (extra build stage or step), a **one-off ECS task** with the same image + env + `migrate-mongo-config.js`, or an operator laptop against staging/prod URL. Ensure the job has **`DATABASE_URL`** and network path to Mongo.

Do **not** run destructive migrations automatically on production without review gates.

---

## 11. Post-deploy verification

| Check | Command / action |
|-------|-------------------|
| Health | `curl https://<alb-dns>/health` and `/health/ready` |
| API | `curl https://<alb-dns>/api/v1/hello` |
| Logs | CloudWatch log group for the ECS task |
| Sentry | If `SENTRY_DSN` set, trigger a test error in staging and confirm the event |

---

## 12. Troubleshooting short list

| Symptom | Likely cause |
|-----------|----------------|
| Task fails to start, cannot pull image | Task execution role missing ECR pull; or no route to ECR (NAT / VPC endpoints) |
| Target unhealthy | Wrong container port, SG blocking ALB → task, or health check path hits DB when Mongo is down |
| `502` from ALB | Task crashing; check stopped task reason and CloudWatch logs |
| Wrong client IP | `TRUST_PROXY_HOPS` not set for ALB hop count |

---

## Files in this repo

| File | Role |
|------|------|
| [`Dockerfile`](../Dockerfile) | Production image |
| [`buildspec.yml`](../buildspec.yml) | CodeBuild: `docker build`, push to ECR, emit `imagedefinitions.json` for ECS |
| [`compose.yaml`](../compose.yaml) | Local stack only (not used by CodePipeline) |

When this document drifts from your exact console UI, use the official guides for [CodePipeline](https://docs.aws.amazon.com/codepipeline/), [CodeBuild](https://docs.aws.amazon.com/codebuild/), and [ECS Fargate](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/AWS_Fargate.html) as the source of truth.
