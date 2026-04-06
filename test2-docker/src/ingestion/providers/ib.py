"""Provider Interactive Brokers"""
from src.config import settings

class IBProvider:
    """Provider for Interactive Brokers"""
    
    def __init__(self):
        self.host = settings.IB_HOST if hasattr(settings, 'IB_HOST') else '127.0.0.1'
        self.port = settings.IB_PORT if hasattr(settings, 'IB_PORT') else 7497
    
    async def connect(self):
        """Conectar ao IB"""
        # Implementar conexão IB
        pass
    
    async def get_latest_data(self):
        """Get data more recentes"""
        pass
    
    async def disconnect(self):
        """Desconectar"""
        pass
