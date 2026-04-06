# Godroox - Architecture Overview

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Next.js Frontend (App Router)                            │  │
│  │  - Marketing Pages (Public)                               │  │
│  │  - Application Dashboard (Authenticated)                  │  │
│  │  - TypeScript + Tailwind CSS                              │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                    BFF / API GATEWAY LAYER                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Next.js API Routes                                       │  │
│  │  - /api/v1/auth/*         (Authentication)               │  │
│  │  - /api/v1/insurance/*    (Life Insurance)               │  │
│  │  - /api/v1/llc/*          (Florida LLC)                   │  │
│  │  - /api/v1/payments/*     (International Payments)        │  │
│  │  - /api/v1/partners/*     (Partner Management)           │  │
│  │  - Authentication & Authorization                         │  │
│  │  - Request Validation                                     │  │
│  │  - Error Handling                                         │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                  BUSINESS SERVICES LAYER                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  Insurance   │  │     LLC      │  │  Payments    │         │
│  │   Service    │  │   Service    │  │   Service    │         │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
│         │                 │                 │                  │
│  ┌──────▼─────────────────▼─────────────────▼──────────────┐  │
│  │           Partner API Service (B2B)                      │  │
│  │  - API Key / OAuth2 Authentication                       │  │
│  │  - Rate Limiting                                         │  │
│  │  - Webhook Support                                       │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                       DATA LAYER                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  PostgreSQL  │  │    Redis     │  │ Data Warehouse│        │
│  │  (Transactional)│  │  (Cache/Session)│  (Analytics)│        │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                    EXTERNAL INTEGRATIONS                        │
│  - Insurance Providers                                          │
│  - Florida State Services (LLC Registration)                    │
│  - Payment Processors (Stripe, Wise, etc.)                      │
│  - Identity Verification Services                               │
└─────────────────────────────────────────────────────────────────┘
```

## Technology Stack

### Frontend
- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Custom design system
- **State Management**: React Context + Server Components
- **Forms**: React Hook Form + Zod validation

### Backend
- **BFF**: Next.js API Routes
- **Business Logic**: Modular services (TypeScript)
- **Authentication**: NextAuth.js / Auth.js
- **API Versioning**: `/api/v1/...`

### Data Layer
- **Transactional DB**: PostgreSQL (via Prisma ORM)
- **Cache/Sessions**: Redis
- **Analytics**: BigQuery (Data Warehouse)
- **Migrations**: Prisma Migrate

### Infrastructure
- **Hosting**: Vercel (Frontend + BFF)
- **CDN**: Vercel Edge Network
- **Monitoring**: Sentry (errors), Vercel Analytics
- **CI/CD**: GitHub Actions
- **Secrets**: Vercel Environment Variables

## Domain Models

### Insurance Domain
- **Customer**: Personal information, health data
- **Policy**: Insurance policy details, coverage, premiums
- **Quote**: Insurance quote calculations
- **Application**: Policy application workflow

### LLC Domain
- **Company**: LLC registration details
- **Document**: Required documents for LLC formation
- **Registration**: Florida state registration status
- **Order**: LLC formation order workflow

### Payments Domain
- **Payment Order**: International payment request
- **Transaction**: Payment transaction details
- **Recipient**: Payment recipient information
- **Currency**: Multi-currency support

### Partners Domain
- **Partner**: B2B partner company
- **API Key**: Partner authentication credentials
- **Integration**: Partner integration configuration
- **Webhook**: Partner webhook endpoints

## Security Considerations

1. **Authentication**: JWT tokens, secure session management
2. **Authorization**: Role-based access control (RBAC)
3. **API Security**: Rate limiting, API key validation, OAuth2
4. **Data Encryption**: Sensitive data encrypted at rest
5. **HTTPS**: All traffic encrypted in transit
6. **CORS**: Properly configured CORS policies
7. **Input Validation**: All inputs validated and sanitized
8. **Secrets Management**: Environment variables, no hardcoded secrets

## Scalability Considerations

1. **Horizontal Scaling**: Stateless services, load balancing
2. **Caching Strategy**: Redis for frequently accessed data
3. **Database Optimization**: Indexes, query optimization, connection pooling
4. **CDN**: Static assets and pages cached at edge
5. **Async Processing**: Background jobs for heavy operations
6. **Rate Limiting**: Protect APIs from abuse

## Observability

1. **Logging**: Structured logs (JSON format)
2. **Error Tracking**: Sentry for error monitoring
3. **Metrics**: Vercel Analytics, custom metrics
4. **Tracing**: Request tracing for debugging
5. **Alerts**: Automated alerts for critical issues
