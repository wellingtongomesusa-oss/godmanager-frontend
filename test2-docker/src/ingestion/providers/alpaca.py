"""Provider Alpaca"""
from src.config import settings

class AlpacaProvider:
    """Provider for Alpaca"""
    
    def __init__(self):
        self.api_key = settings.ALPACA_API_KEY
        self.secret_key = settings.ALPACA_SECRET_KEY
        self.base_url = settings.ALPACA_BASE_URL
    
    async def connect(self):
        """Conectar ao Alpaca"""
        # Implementar conexão
        pass
    
    async def get_latest_data(self):
        """Get data more recentes"""
        pass
    
    async def disconnect(self):
        """Desconectar"""
        pass
