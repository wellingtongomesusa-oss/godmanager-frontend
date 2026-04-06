"""
Classe base for strategies
"""
from abc import ABC, abstractmethod
from typing import Dict, Optional

class BaseStrategy(ABC):
    """Interface base for strategies"""
    
    def __init__(self, name: str):
        self.name = name
        self.active = True
        self.positions = {}
    
    @abstractmethod
    async def check_conditions(self, features: Dict) -> Optional[Dict]:
        """
        Check conditions e gerar sinal
        
        Retorna:
        - None: Sem sinal
        - Dict: {
            "action": "buy" | "sell",
            "symbol": str,
            "quantity": int,
            "price": float,  # Preço limite sugerido
            "confidence": float,  # 0-1
            "stop_loss": float,  # Opcional
            "take_profit": float,  # Opcional
        }
        """
        pass
    
    def is_active(self) -> bool:
        """Verificar if estratégia is ativa"""
        return self.active
    
    def activate(self):
        """Ativar estratégia"""
        self.active = True
    
    def deactivate(self):
        """Desativar estratégia"""
        self.active = False
