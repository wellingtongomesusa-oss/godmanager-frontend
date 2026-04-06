"""
Strategy Manager - Manages multiple strategies
"""
import asyncio
from typing import List, Dict
from loguru import logger
from src.strategies.base_strategy import BaseStrategy
from src.strategies.order_flow_imbalance import OrderFlowImbalanceStrategy
from src.strategies.breakout_aggression import BreakoutAggressionStrategy
from src.strategies.vwap_flow import VWAPFlowStrategy
from src.strategies.momentum_intraday import MomentumIntradayStrategy
from src.strategies.options_iv import OptionsIVStrategy
from src.strategies.pairs_sector_flow import PairsSectorFlowStrategy

class StrategyManager:
    """
    Manages multiple strategies
    
    Pseudocódigo:
    1. Registrar strategies disponíveis
    2. For cada tick de dados:
       a. Calculate features
       b. For cada estratégia ativa:
          - Check conditions (gatilhos)
          - Gerar sinal (buy/sell/hold)
          - Calcular position size
       c. Retornar lista de sinais
    3. Gerenciar posições por estratégia
    """
    
    def __init__(self):
        self.strategies: List[BaseStrategy] = []
        self._register_strategies()
    
    def _register_strategies(self):
        """Register all available strategies"""
        # Estratégias of MVP
        self.strategies.append(OrderFlowImbalanceStrategy())
        self.strategies.append(BreakoutAggressionStrategy())
        self.strategies.append(VWAPFlowStrategy())
        
        # Estratégias V2
        # self.strategies.append(MomentumIntradayStrategy())
        # self.strategies.append(OptionsIVStrategy())
        # self.strategies.append(PairsSectorFlowStrategy())
        
        logger.info(f"Registered {len(self.strategies)} strategies")
    
    async def generate_signals(self, features: Dict) -> List[Dict]:
        """
        Generate signals de todas as strategies
        
        Input: Features calculadas
        Output: Lista de sinais
        """
        signals = []
        
        for strategy in self.strategies:
            if not strategy.is_active():
                continue
            
            try:
                # Check conditions of estratégia
                signal = await strategy.check_conditions(features)
                
                if signal:
                    signal["strategy"] = strategy.name
                    signal["symbol"] = features.get("symbol")
                    signals.append(signal)
                    
            except Exception as e:
                logger.error(f"Erro na estratégia {strategy.name}: {e}")
        
        return signals
