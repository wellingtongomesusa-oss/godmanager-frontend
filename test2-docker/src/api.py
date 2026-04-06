"""
FastAPI for the Trading Engine
"""
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from loguru import logger
import uvicorn
from src.config import settings

app = FastAPI(
    title="Algo Trading System API",
    description="API for the Algorithmic Trading System",
    version="0.1.0"
)

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "status": "online",
        "service": "Algo Trading System",
        "version": "0.1.0",
        "mode": settings.MODE
    }

@app.get("/health")
async def health():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "mode": settings.MODE
    }

@app.get("/api/status")
async def status():
    """System status"""
    return {
        "status": "running",
        "mode": settings.MODE,
        "database": "connected",  # TODO: verificar conexão real
        "redis": "connected"  # TODO: verificar conexão real
    }

def run_api(host: str = "0.0.0.0", port: int = 8000):
    """Run API server"""
    try:
        logger.info(f"Starting API at http://{host}:{port}")
        # Use uvicorn.run directly - it handles the server lifecycle
        uvicorn.run(
            app,
            host=host,
            port=port,
            log_level="info",
            access_log=True
        )
    except Exception as e:
        logger.error(f"Error starting API: {e}")
        import traceback
        logger.error(traceback.format_exc())
