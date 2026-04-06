# Testing API Connection

## Problem: Cannot connect to http://localhost:8000/api/status

## Step 1: Check Docker Status

```bash
cd /Users/wellingtongomes/cursor-projects/test2-docker
./check_docker.sh
```

If Docker is not running:
1. Start Docker Desktop manually
2. Wait for the icon in menu bar to turn green
3. Run `./check_docker.sh` again

## Step 2: Check if Containers are Running

```bash
docker-compose ps
```

You should see:
- `algo_trading_db` - Up
- `algo_trading_redis` - Up  
- `algo_trading_engine` - Up
- `algo_trading_ingestion` - Up (optional)

## Step 3: Check Trading Engine Logs

```bash
docker-compose logs trading_engine --tail 50
```

Look for:
- "Starting system..."
- "API started at http://0.0.0.0:8000"
- Any error messages

## Step 4: Test API from Inside Container

```bash
docker-compose exec trading_engine curl http://localhost:8000/health
```

If this works, the API is running but port mapping might be the issue.

## Step 5: Check Port Mapping

```bash
docker-compose port trading_engine 8000
```

Should show: `0.0.0.0:8000`

## Step 6: Test from Host

```bash
curl http://localhost:8000/health
```

## Common Issues

### Issue 1: Container not running
**Solution**: Start the system
```bash
./start.sh
```

### Issue 2: API not starting
**Check logs**:
```bash
docker-compose logs trading_engine
```

**Common causes**:
- Import errors
- Missing dependencies
- Configuration errors

### Issue 3: Port already in use
**Check**:
```bash
lsof -i :8000
```

**Solution**: Stop whatever is using port 8000, or change port in docker-compose.yml

### Issue 4: Docker daemon not accessible
**Solution**: 
1. Start Docker Desktop
2. Wait for it to fully start (green icon)
3. Try again

## Quick Fix

If nothing works, try a complete restart:

```bash
./stop.sh
./start.sh
```

Wait 10-15 seconds for containers to fully start, then test:
```bash
curl http://localhost:8000/health
```

## Expected Response

When working, you should see:
```json
{"status":"healthy","mode":"paper"}
```
