-- Role supervisor_2 (alinhado a fila supervisor_2). Idempotente.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid=t.oid WHERE t.typname='UserRole' AND e.enumlabel='supervisor_2') THEN
    ALTER TYPE "UserRole" ADD VALUE 'supervisor_2';
  END IF;
END $$;
