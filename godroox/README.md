# Godroox - Fintech Platform

Modern fintech platform offering:
- Life Insurance
- Florida LLC Formation
- International Payments
- B2B Partner API

## Tech Stack

- **Frontend**: Next.js 14+ (App Router), TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Node.js
- **Database**: PostgreSQL (Prisma ORM)
- **Cache**: Redis
- **Analytics**: BigQuery
- **Hosting**: Vercel
- **Monitoring**: Sentry

## Project Structure

```
godroox/
├── app/                    # Next.js App Router
│   ├── (marketing)/       # Public marketing pages
│   ├── (app)/             # Authenticated application
│   └── api/               # API routes (BFF)
├── components/            # React components
│   ├── ui/               # Base UI components
│   ├── layout/           # Layout components
│   ├── marketing/         # Marketing page components
│   └── app/              # App-specific components
├── lib/                  # Utilities and helpers
├── services/             # Business logic services
├── prisma/               # Database schema and migrations
├── public/               # Static assets
└── styles/               # Global styles
```

## Getting Started

### Prerequisites

- Node.js 18+ (ou Docker)
- PostgreSQL (ou Docker)
- Redis (ou Docker)
- Docker (recomendado para desenvolvimento rápido)

### Quick Start com Docker

```bash
# Iniciar tudo com Docker (porta padrão 3000)
./start-docker.sh dev

# Ou com porta customizada
APP_PORT=8080 ./start-docker.sh dev

# Acesse: http://localhost:3000 (ou sua porta customizada)
```

### Instalação Local (sem Docker)

```bash
# Install dependencies
npm install

# Setup environment variables
cp .env.example .env
# Edit .env with your configuration

# Setup database
npm run db:migrate

# Run development server
npm run dev
```

### Configurar Porta

Veja [PORT_CONFIG.md](./PORT_CONFIG.md) para detalhes sobre como alterar portas.

## Environment Variables

See `.env.example` for required environment variables.

## Documentation

- [Architecture](./ARCHITECTURE.md) - System architecture
- [API Documentation](./docs/API.md) - API endpoints
- [Partner API](./docs/PARTNER_API.md) - B2B API documentation

## License

Proprietary - Godroox
