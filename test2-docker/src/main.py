"""
Main entry point for the Trading Engine
"""
import asyncio
import logging
import threading
from loguru import logger
from src.config import settings
from src.api import run_api
from src.ingestion.data_ingestion import DataIngestionService
from src.features.feature_engine import FeatureEngine
from src.strategies.strategy_manager import StrategyManager
from src.risk.risk_manager import RiskManager
from src.execution.execution_engine import ExecutionEngine
from src.paper_trading.paper_trader import PaperTrader
from src.monitoring.monitor import Monitor

# Configure logging
try:
    logger.add("logs/trading_{time}.log", rotation="1 day", retention="30 days")
except Exception as e:
    logger.warning(f"Could not create log file: {e}")

async def trading_loop():
    """Main trading loop"""
    logger.info("Starting Trading Engine...")
    logger.info(f"Mode: {settings.MODE}")
    
    try:
        # Initialize components
        ingestion = DataIngestionService()
        features = FeatureEngine()
        strategies = StrategyManager()
        risk = RiskManager()
        execution = ExecutionEngine()
        monitor = Monitor()
        
        # Paper trading if in paper mode
        paper_trader = None
        if settings.MODE == "paper":
            paper_trader = PaperTrader()
            logger.info("Paper Trading mode activated")
        
        # Start data ingestion (may fail if no API keys)
        try:
            await ingestion.start()
        except Exception as e:
            logger.warning(f"Data ingestion not started (may be normal): {e}")
        
        # Start monitoring
        try:
            await monitor.start()
        except Exception as e:
            logger.warning(f"Monitoring not started: {e}")
        
        # Main loop
        while True:
            try:
                # 1. Get latest data
                latest_data = await ingestion.get_latest_data() if ingestion else None
                
                if not latest_data:
                    await asyncio.sleep(5)  # Wait longer if no data
                    continue
                
                # 2. Calculate features
                features_data = await features.calculate(latest_data)
                
                # 3. Generate signals from strategies
                signals = await strategies.generate_signals(features_data)
                
                # 4. For each signal, check risk
                for signal in signals:
                    # Check risk limits
                    if not await risk.check_signal(signal):
                        logger.warning(f"Signal rejected by risk: {signal}")
                        continue
                    
                    # 5. Execute (paper or live)
                    if settings.MODE == "paper" and paper_trader:
                        await paper_trader.execute(signal)
                    elif settings.MODE == "live":
                        await execution.execute(signal)
                
                # 6. Update monitoring
                try:
                    await monitor.update()
                except:
                    pass
                
                await asyncio.sleep(1)  # 1 second between iterations
                
            except Exception as e:
                logger.error(f"Error in trading loop: {e}")
                await asyncio.sleep(5)
                
    except KeyboardInterrupt:
        logger.info("Stopping Trading Engine...")
    except Exception as e:
        logger.error(f"Fatal error in trading loop: {e}")
    finally:
        try:
            if 'ingestion' in locals():
                await ingestion.stop()
        except:
            pass
        try:
            if 'monitor' in locals():
                await monitor.stop()
        except:
            pass
        logger.info("Trading Engine stopped")

def main():
    """Main function - starts API and trading loop"""
    logger.info("Starting system...")
    
    # Start API in separate thread
    api_thread = threading.Thread(target=run_api, daemon=True)
    api_thread.start()
    logger.info("API started at http://0.0.0.0:8000")
    
    # Run trading loop
    try:
        asyncio.run(trading_loop())
    except KeyboardInterrupt:
        logger.info("System stopped by user")

if __name__ == "__main__":
    main()
