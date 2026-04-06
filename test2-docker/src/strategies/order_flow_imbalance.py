"""
Estratégia 1: Order Flow Imbalance → Mean Reversion

Hipótese: Desequilíbrios extremos de fluxo revertem no curto prazo
"""
from typing import Dict, Optional
from src.strategies.base_strategy import BaseStrategy

class OrderFlowImbalanceStrategy(BaseStrategy):
    """
    Estratégia de mean reversion baseada em order flow imbalance
    
    Pseudocódigo:
    1. Calcular imbalance atual (bid_volume - ask_volume) / total_volume
    2. If imbalance > threshold_buy (ex: 0.7):
       - Sinal: SELL (reversão esperada)
    3. If imbalance < threshold_sell (ex: -0.7):
       - Sinal: BUY (reversão esperada)
    4. Filtros adicionais:
       - Volume mínimo
       - Spread máximo
       - Confirmação de CVD
    """
    
    def __init__(self):
        super().__init__("order_flow_imbalance")
        # Parâmetros (devem vir de backtest/otimização)
        self.imbalance_threshold_buy = -0.7  # Imbalance muito negativo → compra
        self.imbalance_threshold_sell = 0.7   # Imbalance muito positivo → venda
        self.min_volume = 10000
        self.max_spread_bps = 20
        self.min_confidence = 0.6
    
    async def check_conditions(self, features: Dict) -> Optional[Dict]:
        """
        Check conditions for trade
        
        Features necessárias:
        - imbalance: float
        - volume: int
        - spread_bps: float
        - cvd: float (opcional)
        """
        imbalance = features.get("imbalance", 0)
        volume = features.get("volume", 0)
        spread_bps = features.get("spread_bps", 999)
        
        # Filtros básicos
        if volume < self.min_volume:
            return None
        
        if spread_bps > self.max_spread_bps:
            return None
        
        # Verificar imbalance extremo
        action = None
        confidence = 0.0
        
        if imbalance <= self.imbalance_threshold_buy:
            # Imbalance muito negativo → expectativa de reversão for cima
            action = "buy"
            confidence = min(abs(imbalance) / abs(self.imbalance_threshold_buy), 1.0)
        
        elif imbalance >= self.imbalance_threshold_sell:
            # Imbalance muito positivo → expectativa de reversão for baixo
            action = "sell"
            confidence = min(imbalance / self.imbalance_threshold_sell, 1.0)
        
        if action and confidence >= self.min_confidence:
            # Calcular position size (simplificado)
            quantity = self._calculate_position_size(features, confidence)
            
            return {
                "action": action,
                "symbol": features.get("symbol"),
                "quantity": quantity,
                "price": features.get("microprice", features.get("price", 0)),
                "confidence": confidence,
                "stop_loss": self._calculate_stop_loss(features, action),
                "take_profit": self._calculate_take_profit(features, action),
            }
        
        return None
    
    def _calculate_position_size(self, features: Dict, confidence: float) -> int:
        """Calcular tamanho of posição"""
        # Simplificado: baseado em risco fixo
        # Em produção: usar risk manager
        base_size = 100
        return int(base_size * confidence)
    
    def _calculate_stop_loss(self, features: Dict, action: str) -> float:
        """Calcular stop loss"""
        price = features.get("microprice", features.get("price", 0))
        atr = features.get("atr", price * 0.01)  # Fallback 1%
        
        if action == "buy":
            return price - (atr * 2)  # 2x ATR abaixo
        else:
            return price + (atr * 2)  # 2x ATR acima
    
    def _calculate_take_profit(self, features: Dict, action: str) -> float:
        """Calcular take profit"""
        price = features.get("microprice", features.get("price", 0))
        atr = features.get("atr", price * 0.01)
        
        if action == "buy":
            return price + (atr * 3)  # 3x ATR acima
        else:
            return price - (atr * 3)  # 3x ATR abaixo
