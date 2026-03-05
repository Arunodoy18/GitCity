# Deployment

## Docker (Recommended)

### Backend

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --production
COPY backend/ .
RUN npx prisma generate
EXPOSE 5000
CMD ["node", "server.js"]
```

### Frontend

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
```

### Docker Compose

```yaml
version: '3.8'
services:
  backend:
    build:
      context: .
      dockerfile: backend/Dockerfile
    ports:
      - "5000:5000"
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/gitcity
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis

  frontend:
    build:
      context: .
      dockerfile: frontend/Dockerfile
    ports:
      - "80:80"
    depends_on:
      - backend

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: gitcity
      POSTGRES_PASSWORD: postgres
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  pgdata:
```

## Manual Deployment

### Requirements

- Node.js 18+
- PostgreSQL 14+
- Redis 7+ (optional)
- Nginx or similar reverse proxy

### Steps

1. Build frontend: `cd frontend && npm run build`
2. Serve `frontend/dist/` via Nginx
3. Run backend: `cd backend && NODE_ENV=production node server.js`
4. Configure Nginx to proxy `/api/` and `/auth/` to backend port 5000

### Environment Variables (Production)

```env
NODE_ENV=production
PORT=5000
FRONTEND_URL=https://yourdomain.com
GITHUB_CLIENT_ID=your_prod_client_id
GITHUB_CLIENT_SECRET=your_prod_client_secret
JWT_SECRET=a-very-long-random-secret
DATABASE_URL=postgresql://user:pass@db-host:5432/gitcity
REDIS_URL=redis://redis-host:6379
```
