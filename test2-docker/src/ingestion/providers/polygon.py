"""
Provider Polygon.io
"""
import asyncio
from polygon import RESTClient, WebSocketClient
from src.config import settings

class PolygonProvider:
    """Provider for Polygon.io"""
    
    def __init__(self):
        self.api_key = settings.POLYGON_API_KEY
        self.rest_client = None
        self.ws_client = None
        self.connected = False
    
    async def connect(self):
        """Conectar ao Polygon"""
        self.rest_client = RESTClient(self.api_key)
        # WebSocket for dados em tempo real
        self.ws_client = WebSocketClient(
            api_key=self.api_key,
            feed="stocks"  # or "options"
        )
        self.connected = True
    
    async def get_latest_data(self):
        """Get data more recentes"""
        # Implementar lógica de obtenção de dados
        # WebSocket callbacks for dados em tempo real
        pass
    
    async def disconnect(self):
        """Desconectar"""
        if self.ws_client:
            self.ws_client.close()
        self.connected = False
