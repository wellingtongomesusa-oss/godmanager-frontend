"""
Main entry point for Data Ingestion Service
"""
import asyncio
from loguru import logger
from src.ingestion.data_ingestion import DataIngestionService

# Configure logging
try:
    logger.add("logs/ingestion_{time}.log", rotation="1 day", retention="30 days")
except Exception as e:
    logger.warning(f"Could not create log file: {e}")

async def main():
    """Main function for data ingestion"""
    logger.info("Starting Data Ingestion Service...")
    
    ingestion = DataIngestionService()
    
    try:
        await ingestion.start()
        
        # Keep running
        while True:
            await asyncio.sleep(60)  # Check every minute
            
    except KeyboardInterrupt:
        logger.info("Stopping Data Ingestion Service...")
    except Exception as e:
        logger.error(f"Fatal error in data ingestion: {e}")
    finally:
        await ingestion.stop()
        logger.info("Data Ingestion Service stopped")

if __name__ == "__main__":
    asyncio.run(main())
