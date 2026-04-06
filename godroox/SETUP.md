# Godroox - Setup Guide

## Prerequisites

- Node.js 18+ installed
- PostgreSQL database
- Redis server
- pnpm (recommended) or npm

## Step-by-Step Setup

### 1. Install Dependencies

```bash
cd /Users/wellingtongomes/cursor-projects/godroox
npm install
# or
pnpm install
```

### 2. Environment Configuration

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

**Required:**
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `NEXTAUTH_SECRET` - Random secret (generate with: `openssl rand -base64 32`)
- `NEXTAUTH_URL` - Your app URL (http://localhost:3000 for dev)

**Optional (for full functionality):**
- `GOOGLE_CLOUD_PROJECT_ID` - For BigQuery analytics
- `GOOGLE_APPLICATION_CREDENTIALS` - Path to GCP credentials JSON
- `SENTRY_DSN` - For error tracking
- External API keys (insurance, LLC, payments)

### 3. Database Setup

```bash
# Generate Prisma Client
npm run db:generate

# Run migrations
npm run db:migrate

# (Optional) Open Prisma Studio to view data
npm run db:studio
```

### 4. Start Development Server

```bash
npm run dev
```

Visit http://localhost:3000

## Development Workflow

### Running Type Checks

```bash
npm run type-check
```

### Linting

```bash
npm run lint
```

### Database Migrations

When you change the Prisma schema:

```bash
# Create new migration
npm run db:migrate

# Regenerate Prisma Client
npm run db:generate
```

## Project Structure Overview

```
godroox/
├── app/                      # Next.js App Router
│   ├── (marketing)/         # Public marketing pages
│   ├── (app)/               # Authenticated app pages
│   └── api/                 # API routes (BFF)
│       ├── auth/            # NextAuth.js
│       └── v1/              # Versioned API endpoints
├── components/              # React components
│   ├── ui/                 # Base UI components
│   ├── layout/             # Layout components
│   ├── marketing/           # Marketing-specific
│   └── app/                # App-specific
├── lib/                    # Utilities
│   ├── db.ts               # Prisma client
│   ├── redis.ts            # Redis client
│   ├── auth.ts             # NextAuth config
│   ├── analytics.ts        # Analytics service
│   └── utils.ts            # Helper functions
├── services/               # Business logic
│   ├── insurance/          # Insurance domain
│   ├── llc/                # LLC domain
│   ├── payments/           # Payments domain
│   └── partners/           # Partners domain
├── prisma/                 # Database
│   └── schema.prisma       # Database schema
└── types/                  # TypeScript types
```

## Testing the API

### Health Check

```bash
curl http://localhost:3000/api/v1/health
```

### Insurance Quote (requires auth)

```bash
curl -X POST http://localhost:3000/api/v1/insurance/quotes \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=..." \
  -d '{
    "coverageAmount": 500000,
    "termLength": 20,
    "dateOfBirth": "1990-01-01T00:00:00Z",
    "gender": "male"
  }'
```

## Deployment

### Vercel Deployment

1. Push code to GitHub
2. Connect repository to Vercel
3. Configure environment variables in Vercel dashboard
4. Deploy

Vercel will automatically:
- Build the Next.js app
- Deploy to edge network
- Set up HTTPS
- Configure CDN

### Environment Variables in Vercel

Add all variables from `.env.example` to Vercel dashboard:
- Settings → Environment Variables

## Troubleshooting

### Database Connection Issues

- Verify PostgreSQL is running
- Check `DATABASE_URL` format: `postgresql://user:password@host:port/database`
- Test connection: `psql $DATABASE_URL`

### Redis Connection Issues

- Verify Redis is running: `redis-cli ping`
- Check `REDIS_URL` format: `redis://localhost:6379`

### Build Errors

- Clear `.next` folder: `rm -rf .next`
- Reinstall dependencies: `rm -rf node_modules && npm install`
- Regenerate Prisma Client: `npm run db:generate`

## Next Steps

1. Complete authentication implementation
2. Add form components for applications
3. Integrate external APIs
4. Add email notifications
5. Implement file uploads
6. Add comprehensive error handling
7. Write tests

## Support

For issues or questions, refer to:
- [Architecture Documentation](./ARCHITECTURE.md)
- [API Documentation](./docs/API.md)
- [Implementation Summary](./IMPLEMENTATION_SUMMARY.md)
