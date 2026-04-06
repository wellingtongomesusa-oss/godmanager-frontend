# Godroox - Docker Setup Guide

## 🐳 Quick Start

### Start the Application

```bash
# Production mode
./scripts/docker-start.sh

# Development mode (with hot reload)
./scripts/docker-start.sh dev
```

### Stop the Application

```bash
./scripts/docker-stop.sh
```

### View Logs

```bash
# View all logs
./scripts/docker-logs.sh

# View specific service
./scripts/docker-logs.sh app
./scripts/docker-logs.sh postgres
./scripts/docker-logs.sh redis
```

## 📋 Manual Commands

### Start Services

```bash
# Production
docker-compose up -d --build

# Development
docker-compose -f docker-compose.dev.yml up -d --build
```

### Stop Services

```bash
# Production
docker-compose down

# Development
docker-compose -f docker-compose.dev.yml down
```

### View Logs

```bash
docker-compose logs -f app
```

### Access Database

```bash
# Connect to PostgreSQL
docker-compose exec postgres psql -U godroox -d godroox

# Connect to Redis
docker-compose exec redis redis-cli
```

### Run Migrations

```bash
# Production
docker-compose exec app npx prisma migrate deploy

# Development
docker-compose exec app npx prisma migrate dev
```

## 🏗️ Architecture

The Docker setup includes:

1. **PostgreSQL** (port 5432)
   - Database: `godroox`
   - User: `godroox`
   - Password: `godroox_dev_password`

2. **Redis** (port 6379)
   - Used for caching and sessions

3. **Next.js App** (port 3000)
   - Production or development mode
   - Auto-reloads in dev mode

## 🔧 Configuration

### Environment Variables

The Docker Compose files include default development values. For production:

1. Create `.env` file
2. Update `docker-compose.yml` to use environment variables
3. Use secrets management

### Database Connection

The app automatically connects to:
- PostgreSQL: `postgresql://godroox:godroox_dev_password@postgres:5432/godroox`
- Redis: `redis://redis:6379`

## 🚀 First Time Setup

1. **Start services:**
   ```bash
   ./scripts/docker-start.sh dev
   ```

2. **Run migrations:**
   ```bash
   docker-compose exec app npx prisma migrate dev
   ```

3. **Access the app:**
   - Open http://localhost:3000

## 🐛 Troubleshooting

### Port Already in Use

If ports 3000, 5432, or 6379 are in use:

1. Stop the conflicting service
2. Or change ports in `docker-compose.yml`

### Database Connection Errors

```bash
# Check if PostgreSQL is running
docker-compose ps

# Check PostgreSQL logs
docker-compose logs postgres

# Restart PostgreSQL
docker-compose restart postgres
```

### Prisma Client Not Generated

```bash
docker-compose exec app npx prisma generate
```

### Clear Everything and Start Fresh

```bash
# Stop and remove containers, volumes
docker-compose down -v

# Start again
./scripts/docker-start.sh dev
```

## 📊 Services Status

Check service status:

```bash
docker-compose ps
```

## 🔐 Security Notes

- Default passwords are for **development only**
- Change all passwords for production
- Use Docker secrets in production
- Never commit `.env` files

## 📚 More Information

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Next.js Docker Documentation](https://nextjs.org/docs/deployment#docker-image)
