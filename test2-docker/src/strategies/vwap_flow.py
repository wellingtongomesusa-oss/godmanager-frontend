"""
Estratégia 3: VWAP/Anchored VWAP + Fluxo
"""
from typing import Dict, Optional
from src.strategies.base_strategy import BaseStrategy

class VWAPFlowStrategy(BaseStrategy):
    """
    VWAP deviation with confirmação de fluxo
    
    Pseudocódigo:
    1. Calcular desvio of VWAP
    2. Verificar fluxo direcional (CVD, imbalance)
    3. If desvio > threshold + fluxo confirmando:
       - Sinal: Seguir direção
    """
    
    def __init__(self):
        super().__init__("vwap_flow")
        self.vwap_deviation_threshold = 0.005  # 0.5%
        self.flow_confirmation_threshold = 0.5
    
    async def check_conditions(self, features: Dict) -> Optional[Dict]:
        """Check conditions VWAP + fluxo"""
        vwap_dev = features.get("vwap_deviation", 0)
        imbalance = features.get("imbalance", 0)
        
        if abs(vwap_dev) < self.vwap_deviation_threshold:
            return None
        
        # Fluxo deve confirmar direção
        if vwap_dev > 0 and imbalance < self.flow_confirmation_threshold:
            return None  # Preço acima VWAP mas fluxo not confirma
        
        if vwap_dev < 0 and imbalance > -self.flow_confirmation_threshold:
            return None  # Preço abaixo VWAP mas fluxo not confirma
        
        action = "buy" if vwap_dev < 0 else "sell"
        confidence = min(abs(vwap_dev) / self.vwap_deviation_threshold, 1.0)
        
        return {
            "action": action,
            "symbol": features.get("symbol"),
            "quantity": 100,
            "price": features.get("microprice", features.get("price", 0)),
            "confidence": confidence,
        }
