# Godroox API Documentation

## Base URL

```
Production: https://api.godroox.com/api/v1
Development: http://localhost:3000/api/v1
```

## Authentication

### User Authentication (Web App)

Uses NextAuth.js session-based authentication. Include session cookie in requests.

### Partner API Authentication

Use API key authentication via header:

```
X-API-Key: gdx_your_api_key_here
```

## API Endpoints

### Health Check

```
GET /api/v1/health
```

Returns system health status.

### Insurance

#### Get Quote
```
POST /api/v1/insurance/quotes
```

**Request Body:**
```json
{
  "coverageAmount": 500000,
  "termLength": 20,
  "dateOfBirth": "1990-01-01T00:00:00Z",
  "gender": "male",
  "healthInfo": {}
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "coverageAmount": 500000,
    "termLength": 20,
    "monthlyPremium": 45.50,
    "annualPremium": 546.00,
    "quoteId": "QUOTE-1234567890-abc123"
  }
}
```

#### Create Application
```
POST /api/v1/insurance/applications
```

#### Get Applications
```
GET /api/v1/insurance/applications
```

### LLC Formation

#### Create LLC Order
```
POST /api/v1/llc/orders
```

#### Get LLC Orders
```
GET /api/v1/llc/orders
```

### International Payments

#### Get Payment Quote
```
POST /api/v1/payments/quotes
```

#### Create Payment Order
```
POST /api/v1/payments/orders
```

### Partners (B2B API)

#### Create Insurance Application (Partner)
```
POST /api/v1/partners/insurance
Headers: X-API-Key: gdx_your_api_key
```

#### Create LLC Order (Partner)
```
POST /api/v1/partners/llc
Headers: X-API-Key: gdx_your_api_key
```

#### Create Payment Order (Partner)
```
POST /api/v1/partners/payments
Headers: X-API-Key: gdx_your_api_key
```

## Rate Limiting

- **User API**: 100 requests per minute
- **Partner API**: Configurable per partner (default: 100 requests per hour)

## Error Responses

All errors follow this format:

```json
{
  "success": false,
  "error": "Error message",
  "message": "Detailed error description"
}
```

## Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `429` - Rate Limit Exceeded
- `500` - Internal Server Error
