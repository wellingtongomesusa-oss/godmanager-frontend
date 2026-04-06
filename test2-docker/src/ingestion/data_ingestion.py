"""
Service for ingestão de dados
Pseudocode and structure for multi-source data ingestion
"""
import asyncio
import logging
from typing import Dict, List, Optional
from datetime import datetime
from loguru import logger
import redis.asyncio as redis
from sqlalchemy import create_engine
from src.config import settings

class DataIngestionService:
    """
    Main data ingestion service
    
    Pseudocódigo:
    1. Conectar a provedor de dados (Polygon, IB, Alpaca)
    2. Subscrever a streams de dados (preços, T&S, L2)
    3. Normalizar dados for formato interno
    4. Buffer em Redis for baixa latência
    5. Persistir em TimescaleDB for histórico
    6. Notificar consumidores via Redis pub/sub
    """
    
    def __init__(self):
        self.redis_client: Optional[redis.Redis] = None
        self.db_engine = None
        self.providers = {}
        self.running = False
        
    async def start(self):
        """Start ingestion service"""
        logger.info("Starting Data Ingestion Service...")
        
        # Connect Redis
        self.redis_client = await redis.from_url(
            f"redis://{settings.REDIS_HOST}:{settings.REDIS_PORT}"
        )
        
        # Connect database
        db_url = (
            f"postgresql://{settings.DB_USER}:{settings.DB_PASSWORD}"
            f"@{settings.DB_HOST}:{settings.DB_PORT}/{settings.DB_NAME}"
        )
        self.db_engine = create_engine(db_url)
        
        # Initialize providers based on configuration
        if settings.DATA_PROVIDER == "polygon":
            from src.ingestion.providers.polygon import PolygonProvider
            self.providers["polygon"] = PolygonProvider()
        elif settings.DATA_PROVIDER == "alpaca":
            from src.ingestion.providers.alpaca import AlpacaProvider
            self.providers["alpaca"] = AlpacaProvider()
        elif settings.DATA_PROVIDER == "ib":
            from src.ingestion.providers.ib import IBProvider
            self.providers["ib"] = IBProvider()
        
        # Start providers
        for provider in self.providers.values():
            await provider.connect()
        
        self.running = True
        
        # Start ingestion tasks
        asyncio.create_task(self._ingestion_loop())
        
        logger.info("Data Ingestion Service started")
    
    async def _ingestion_loop(self):
        """Main ingestion loop"""
        while self.running:
            try:
                # For each active provider
                for name, provider in self.providers.items():
                    # Get new data
                    data = await provider.get_latest_data()
                    
                    if data:
                        # Normalize data
                        normalized = self._normalize_data(data, name)
                        
                        # Buffer in Redis (low latency)
                        await self._buffer_to_redis(normalized)
                        
                        # Persist to TimescaleDB (history)
                        await self._persist_to_db(normalized)
                        
                        # Publish to consumers
                        await self._publish_data(normalized)
                
                await asyncio.sleep(0.1)  # 100ms
                
            except Exception as e:
                logger.error(f"Error in ingestion loop: {e}")
                await asyncio.sleep(1)
    
    def _normalize_data(self, data: Dict, provider: str) -> Dict:
        """
        Normalizar dados de diferentes providers for formato interno
        
        Formato interno:
        {
            "symbol": "AAPL",
            "timestamp": datetime,
            "type": "trade" | "quote" | "bar",
            "price": float,
            "volume": int,
            "bid": float,  # if quote
            "ask": float,  # if quote
            "aggressor": "buy" | "sell",  # if trade
            ...
        }
        """
        # Implementar normalização específica por provider
        normalized = {
            "symbol": data.get("symbol"),
            "timestamp": datetime.utcnow(),
            "provider": provider,
            **data
        }
        return normalized
    
    async def _buffer_to_redis(self, data: Dict):
        """Buffer de dados em Redis for acesso rápido"""
        key = f"data:{data['symbol']}:latest"
        await self.redis_client.setex(
            key,
            60,  # TTL 60s
            str(data)  # Serializar (usar JSON em produção)
        )
    
    async def _persist_to_db(self, data: Dict):
        """Persistir dados em TimescaleDB"""
        # Implementar inserção em batch for performance
        # Usar TimescaleDB hypertables for séries temporais
        pass
    
    async def _publish_data(self, data: Dict):
        """Publicar dados via Redis pub/sub"""
        channel = f"data:{data['symbol']}"
        await self.redis_client.publish(channel, str(data))
    
    async def get_latest_data(self, symbol: Optional[str] = None) -> Optional[Dict]:
        """Get data more recentes (of Redis buffer)"""
        if symbol:
            key = f"data:{symbol}:latest"
            data = await self.redis_client.get(key)
            return eval(data) if data else None
        else:
            # Retornar dados de todos os símbolos monitorados
            # Implementar conforme necessário
            return None
    
    async def stop(self):
        """Stop ingestion service"""
        logger.info("Stopping Data Ingestion Service...")
        self.running = False
        
        # Stop providers
        for provider in self.providers.values():
            await provider.disconnect()
        
        # Close connections
        if self.redis_client:
            await self.redis_client.close()
        
        logger.info("Data Ingestion Service stopped")
