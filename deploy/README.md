# Deploy PayPilot AI lên VPS

Hướng dẫn triển khai production cơ bản cho Sprint 1. Cần VPS Ubuntu 22.04+, Docker, Docker Compose, Nginx.

## 1. Chuẩn bị VPS

```bash
# Cài Docker + Docker Compose plugin
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Clone repo
git clone https://github.com/lengocanh2005it/paypilot-ai.git
cd paypilot-ai
```

## 2. Cấu hình môi trường

```bash
cp .env.example .env
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env
# Sửa JWT secrets, Cas keys (sandbox console), FRONTEND_URL / APP_URL khi deploy production
```

## 3. Chạy full stack bằng Docker Compose

```bash
docker compose --profile production up -d --build
```

Services:
- `postgres` — PostgreSQL pgvector
- `redis` — Redis
- `backend` — NestJS API (port 3000)
- `frontend` — Vite dev (profile `dev`) hoặc Nginx static (profile `production`)

## 4. Nginx reverse proxy + HTTPS

```bash
sudo cp deploy/nginx/paypilot.conf /etc/nginx/sites-available/paypilot
sudo ln -s /etc/nginx/sites-available/paypilot /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# Let's Encrypt
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d YOUR_DOMAIN
```

## 5. GitHub Actions deploy (tùy chọn)

Workflow `.github/workflows/deploy.yml` dùng `workflow_dispatch`. Cấu hình GitHub Secrets:

| Secret | Mô tả |
|---|---|
| `DEPLOY_HOST` | IP hoặc domain VPS |
| `DEPLOY_USER` | SSH user (vd `ubuntu`) |
| `DEPLOY_SSH_KEY` | Private key SSH |
| `DEPLOY_PATH` | Đường dẫn repo trên VPS (vd `/home/ubuntu/paypilot-ai`) |

Chạy deploy: GitHub → Actions → Deploy → Run workflow.
