"""
Paper Trader - Simulação de trading ao vivo
"""
from typing import Dict, List
from datetime import datetime
from loguru import logger

class PaperTrader:
    """
    Simulador de paper trading
    
    Pseudocódigo:
    1. Receber sinal aprovado
    2. Simular execução:
       - Obter preço atual (of livro or proxy)
       - Aplicar slippage modelado
       - Simular fill parcial/completo
       - Aplicar atraso configurável
    3. Registrar trade
    4. Atualizar PnL
    5. Manter histórico de trades
    """
    
    def __init__(self):
        self.positions = {}  # {symbol: quantity}
        self.trades = []  # Histórico de trades
        self.pnl = 0.0
        self.capital = 100000.0  # Capital inicial
    
    async def execute(self, signal: Dict):
        """Executar trade simulado"""
        symbol = signal["symbol"]
        action = signal["action"]
        quantity = signal["quantity"]
        target_price = signal.get("price", 0)
        
        # Simular execução
        fill_price = await self._simulate_fill(signal)
        
        # Calcular slippage
        slippage = abs(fill_price - target_price) if target_price > 0 else 0
        
        # Atualizar posição
        if action == "buy":
            self.positions[symbol] = self.positions.get(symbol, 0) + quantity
            cost = fill_price * quantity
            self.capital -= cost
        else:  # sell
            self.positions[symbol] = self.positions.get(symbol, 0) - quantity
            proceeds = fill_price * quantity
            self.capital += proceeds
        
        # Registrar trade
        trade = {
            "timestamp": datetime.now(),
            "symbol": symbol,
            "action": action,
            "quantity": quantity,
            "price": fill_price,
            "target_price": target_price,
            "slippage": slippage,
        }
        self.trades.append(trade)
        
        logger.info(f"Paper trade executado: {trade}")
        
        return trade
    
    async def _simulate_fill(self, signal: Dict) -> float:
        """
        Simular fill de ordem
        
        Pseudocódigo:
        1. Obter preço atual (of mercado real)
        2. Aplicar slippage baseado em:
           - Volatilidade
           - Spread
           - Tamanho of ordem
        3. Simular atraso (latência)
        4. Retornar preço de fill
        """
        target_price = signal.get("price", 0)
        quantity = signal.get("quantity", 0)
        
        # Slippage modelado (simplificado)
        # Em produção: usar modelo more sofisticado
        volatility = signal.get("realized_vol", 0.01)
        spread_bps = signal.get("spread_bps", 10)
        
        # Slippage aumenta with volatilidade e tamanho
        slippage_factor = volatility * (1 + quantity / 1000) * 0.5
        slippage = target_price * slippage_factor
        
        # Adicionar spread (metade of spread como custo)
        spread_cost = target_price * (spread_bps / 10000) * 0.5
        
        if signal["action"] == "buy":
            fill_price = target_price + slippage + spread_cost
        else:
            fill_price = target_price - slippage - spread_cost
        
        return fill_price
    
    def get_pnl(self) -> float:
        """Calcular PnL atual"""
        # PnL realizado (trades fechados) já is em self.pnl
        # PnL not realizado (posições abertas) precisa de preços atuais
        return self.pnl
    
    def get_positions(self) -> Dict:
        """Obter posições atuais"""
        return self.positions.copy()
    
    def get_trades(self) -> List[Dict]:
        """Obter histórico de trades"""
        return self.trades.copy()
