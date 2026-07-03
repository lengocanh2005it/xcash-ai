# Deploy Klassi AI lên VPS

## Yêu cầu

- Ubuntu 22.04+ (hoặc tương đương)
- Docker + Docker Compose v2
- Nginx (reverse proxy)
- Domain trỏ về VPS (cho HTTPS)

## Cài đặt lần đầu

```bash
git clone https://github.com/lengocanh2005it/klassi-ai.git
cd klassi-ai
cp .env.example .env
# Chỉnh .env: JWT secrets, CAS keys, DATABASE_URL...
docker compose --profile production up -d --build
```

## Nginx

```bash
sudo cp deploy/nginx/klassi.conf /etc/nginx/sites-available/klassi
sudo ln -s /etc/nginx/sites-available/klassi /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## GitHub Actions deploy

Workflow `deploy.yml` dùng SSH để pull + `docker compose up` trên VPS.

| Secret | Mô tả |
|---|---|
| `DEPLOY_HOST` | IP hoặc hostname VPS |
| `DEPLOY_USER` | SSH user (vd `ubuntu`) |
| `DEPLOY_SSH_KEY` | Private key SSH |
| `DEPLOY_PATH` | Đường dẫn repo trên VPS (vd `/home/ubuntu/klassi-ai`) |
