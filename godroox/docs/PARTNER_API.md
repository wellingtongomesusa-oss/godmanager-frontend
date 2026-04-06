# Godroox Partner API Documentation

## Overview

The Godroox Partner API allows businesses to integrate life insurance, LLC formation, and international payment services into their platforms.

## Authentication

All Partner API requests require an API key in the header:

```
X-API-Key: gdx_your_api_key_here
```

## Getting Started

1. **Sign up** for a partner account at https://godroox.com/parceiros
2. **Create** a partner account through the dashboard
3. **Receive** your API key (shown only once - save it securely)
4. **Start** integrating using the endpoints below

## Base URL

```
Production: https://api.godroox.com/api/v1/partners
Sandbox: https://sandbox-api.godroox.com/api/v1/partners
```

## Rate Limiting

Default rate limit: **100 requests per hour** per API key.

Contact support to increase your rate limit.

## Endpoints

### Insurance

#### Create Insurance Application

```
POST /api/v1/partners/insurance
```

**Request:**
```json
{
  "customerId": "your-customer-id",
  "coverageAmount": 500000,
  "termLength": 20,
  "firstName": "John",
  "lastName": "Doe",
  "dateOfBirth": "1990-01-01T00:00:00Z",
  "gender": "male",
  "address": {
    "street": "123 Main St",
    "city": "Miami",
    "state": "FL",
    "zipCode": "33101",
    "country": "US"
  },
  "healthInfo": {}
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "applicationId": "app_123",
    "status": "DRAFT",
    "quoteId": "QUOTE-123",
    "monthlyPremium": 45.50
  }
}
```

### LLC Formation

#### Create LLC Order

```
POST /api/v1/partners/llc
```

### International Payments

#### Create Payment Order

```
POST /api/v1/partners/payments
```

## Webhooks

Configure webhook URLs in your partner dashboard to receive real-time notifications:

- `insurance.application.approved`
- `insurance.policy.created`
- `llc.order.filed`
- `llc.order.approved`
- `payment.order.completed`
- `payment.order.failed`

## Sandbox Environment

Use the sandbox environment for testing:

- Base URL: `https://sandbox-api.godroox.com/api/v1/partners`
- Test API keys available in sandbox dashboard
- No real transactions or charges

## Support

- Documentation: https://docs.godroox.com
- Support Email: partners@godroox.com
- Status Page: https://status.godroox.com
