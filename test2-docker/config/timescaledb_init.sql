-- Inicialização do TimescaleDB

-- Criar extensão TimescaleDB
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Tabela de dados intradiários
CREATE TABLE IF NOT EXISTS intraday_bars (
    time TIMESTAMPTZ NOT NULL,
    symbol VARCHAR(10) NOT NULL,
    open DOUBLE PRECISION,
    high DOUBLE PRECISION,
    low DOUBLE PRECISION,
    close DOUBLE PRECISION,
    volume BIGINT,
    PRIMARY KEY (time, symbol)
);

-- Criar hypertable para séries temporais
SELECT create_hypertable('intraday_bars', 'time', if_not_exists => TRUE);

-- Índices
CREATE INDEX IF NOT EXISTS idx_intraday_bars_symbol ON intraday_bars (symbol, time DESC);

-- Tabela de trades
CREATE TABLE IF NOT EXISTS trades (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL,
    symbol VARCHAR(10) NOT NULL,
    action VARCHAR(4) NOT NULL,
    quantity INTEGER NOT NULL,
    price DOUBLE PRECISION NOT NULL,
    strategy VARCHAR(50),
    pnl DOUBLE PRECISION,
    slippage DOUBLE PRECISION
);

-- Índices para trades
CREATE INDEX IF NOT EXISTS idx_trades_timestamp ON trades (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades (symbol, timestamp DESC);

-- Tabela de posições
CREATE TABLE IF NOT EXISTS positions (
    symbol VARCHAR(10) PRIMARY KEY,
    quantity INTEGER NOT NULL,
    avg_price DOUBLE PRECISION NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabela de PnL diário
CREATE TABLE IF NOT EXISTS daily_pnl (
    date DATE PRIMARY KEY,
    pnl DOUBLE PRECISION NOT NULL,
    trades_count INTEGER DEFAULT 0
);
