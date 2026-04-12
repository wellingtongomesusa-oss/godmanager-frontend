-- Referência PostgreSQL (persistência atual: data/rent-advances.json via API Next.js)
CREATE TABLE IF NOT EXISTS rent_advances (
  id UUID PRIMARY KEY,
  owner_id TEXT NOT NULL,
  property_id UUID,
  months INT NOT NULL CHECK (months >= 1 AND months <= 24),
  gross_amount DECIMAL(14, 2) NOT NULL,
  present_value DECIMAL(14, 2) NOT NULL,
  annual_rate DECIMAL(6, 4) NOT NULL DEFAULT 0.18,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'paid', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rent_advances_owner ON rent_advances (owner_id);
CREATE INDEX IF NOT EXISTS idx_rent_advances_status ON rent_advances (status);
