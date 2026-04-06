"""
Risk Manager - Gestão de risco e guardrails
"""
from typing import Dict
from datetime import datetime, timedelta
from loguru import logger
from src.config import settings

class RiskManager:
    """
    Gestão de risco e guardrails
    
    Pseudocódigo:
    1. Verificar limites diários/semanais de perda
    2. Verificar limites de posição por ativo
    3. Verificar limites de ordens/minuto
    4. For opções: verificar greeks
    5. Verificar regras de not-trade (spreads, liquidez, eventos)
    6. Retornar aprovação/rejeição
    """
    
    def __init__(self):
        self.daily_pnl = 0.0
        self.weekly_pnl = 0.0
        self.positions = {}  # {symbol: quantity}
        self.order_count = 0
        self.last_order_reset = datetime.now()
        self.max_daily_loss = settings.MAX_DAILY_LOSS
        self.max_weekly_loss = settings.MAX_WEEKLY_LOSS
        self.max_position_size = settings.MAX_POSITION_SIZE
        self.max_orders_per_minute = settings.MAX_ORDERS_PER_MINUTE
        self.kill_switch_active = False
    
    async def check_signal(self, signal: Dict) -> bool:
        """
        Verificar if sinal passa pelos checks de risco
        
        Retorna: True if aprovado, False if rejeitado
        """
        # Kill switch
        if self.kill_switch_active:
            logger.warning("Kill switch ativo - rejeitando sinal")
            return False
        
        # Verificar limites de perda
        if not self._check_loss_limits():
            logger.warning("Limite de perda atingido")
            return False
        
        # Verificar limite de ordens/minuto
        if not self._check_order_rate_limit():
            logger.warning("Limite de ordens/minuto atingido")
            return False
        
        # Verificar limite de posição
        if not self._check_position_limit(signal):
            logger.warning("Limite de posição atingido")
            return False
        
        # Verificar spread (if disponível)
        if not self._check_spread(signal):
            logger.warning("Spread muito aberto")
            return False
        
        # Verificar liquidez
        if not self._check_liquidity(signal):
            logger.warning("Liquidez insuficiente")
            return False
        
        # Verificar eventos (earnings, FOMC, etc.)
        if not self._check_events(signal):
            logger.warning("Evento de mercado - not trading")
            return False
        
        return True
    
    def _check_loss_limits(self) -> bool:
        """Verificar limites de perda diária/semanal"""
        if self.daily_pnl <= -self.max_daily_loss:
            return False
        if self.weekly_pnl <= -self.max_weekly_loss:
            return False
        return True
    
    def _check_order_rate_limit(self) -> bool:
        """Verificar limite de ordens por minuto"""
        now = datetime.now()
        if (now - self.last_order_reset).seconds >= 60:
            self.order_count = 0
            self.last_order_reset = now
        
        if self.order_count >= self.max_orders_per_minute:
            return False
        
        return True
    
    def _check_position_limit(self, signal: Dict) -> bool:
        """Verificar limite de posição por ativo"""
        symbol = signal.get("symbol")
        quantity = signal.get("quantity", 0)
        price = signal.get("price", 0)
        
        current_position = self.positions.get(symbol, 0)
        new_position = current_position + quantity if signal["action"] == "buy" else current_position - quantity
        
        position_value = abs(new_position * price)
        
        if position_value > self.max_position_size:
            return False
        
        return True
    
    def _check_spread(self, signal: Dict) -> bool:
        """Verificar if spread not is muito aberto"""
        # If spread_bps disponível nos features, verificar
        # Por enquanto, sempre aprovar
        return True
    
    def _check_liquidity(self, signal: Dict) -> bool:
        """Verificar liquidez mínima"""
        # Verificar volume mínimo
        # Por enquanto, sempre aprovar
        return True
    
    def _check_events(self, signal: Dict) -> bool:
        """Verificar eventos de mercado (earnings, FOMC)"""
        # Implementar calendário de eventos
        # Por enquanto, sempre aprovar
        return True
    
    def update_pnl(self, pnl: float):
        """Atualizar PnL diário/semanal"""
        self.daily_pnl += pnl
        self.weekly_pnl += pnl
    
    def update_position(self, symbol: str, quantity: int):
        """Atualizar posição"""
        current = self.positions.get(symbol, 0)
        new = current + quantity
        if new == 0:
            del self.positions[symbol]
        else:
            self.positions[symbol] = new
    
    def record_order(self):
        """Registrar ordem executada"""
        self.order_count += 1
    
    def activate_kill_switch(self):
        """Ativar kill switch"""
        self.kill_switch_active = True
        logger.critical("KILL SWITCH ATIVADO")
    
    def deactivate_kill_switch(self):
        """Desativar kill switch"""
        self.kill_switch_active = False
        logger.info("Kill switch desativado")
