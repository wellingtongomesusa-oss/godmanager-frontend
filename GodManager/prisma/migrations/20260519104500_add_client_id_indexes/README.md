## clientId indexes (idempotent)

Historical migrations (`20260503225740_add_client_id_to_business_tables`, etc.) already define btree indexes named `*_clientId_idx` on `"clientId"`.

Prisma Migrate runs each migration **inside a transaction**, so **`CREATE INDEX CONCURRENTLY`** cannot be used in `migration.sql` (PostgreSQL error 25001).

This folder’s **`migration.sql`** uses **`CREATE INDEX IF NOT EXISTS`** (non-concurrent) with the **same index names Prisma originally created**:

- Guarantees staging / partial deploys missing an index still get one.
- In production where indexes already exist, each statement is a **no-op** (no redundant second index).

### Optional strict zero-lock path (outside Prisma)

To rebuild with `CONCURRENTLY`, run **`concurrent_optional.sql`** manually with psql (**not** wrapped in BEGIN), then record the revision as applied if needed:

```bash
DATABASE_URL="$DATABASE_URL_PRODUCTION" psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f prisma/migrations/20260519104500_add_client_id_indexes/concurrent_optional.sql
```

The optional file repeats the **same index names**, so **`IF NOT EXISTS`** skips existing indexes — again **no duplication**.
