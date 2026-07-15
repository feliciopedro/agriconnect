# AgriConnect Backend API

AgriConnect is a mobile-first agricultural marketplace API connecting smallholder farmers in Ghana's Eastern Region with buyers, transporters, and market infrastructure. It supports REST API access, USSD/SMS access for feature phones, full supply-chain traceability with QR codes, Paystack payment processing, and Africa's Talking SMS/USSD integration.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment Variables](#environment-variables)
- [Running Locally](#running-locally)
- [Database Migrations & Seeding](#database-migrations--seeding)
- [Running Tests](#running-tests)
- [Local USSD Testing](#local-ussd-testing)
- [Africa's Talking Sandbox Setup](#africas-talking-sandbox-setup)
- [Endpoint Map](#endpoint-map)
- [Architecture Notes](#architecture-notes)

---

## Prerequisites

- **Node.js** ≥ 18.x
- **npm** ≥ 9.x
- **PostgreSQL** ≥ 14 with PostGIS extension enabled
- **Git**

```bash
# Verify versions
node -v
npm -v
psql --version
```

---

## Installation

```bash
# 1. Clone the repository
git clone https://github.com/your-org/agriconnect.git
cd agriconnect/backend

# 2. Install dependencies
npm install

# 3. Copy the environment template
cp .env.example .env
# Then edit .env and fill in all required values (see below)

# 4. Generate the Prisma client
npx prisma generate
```

---

## Environment Variables

Create a `.env` file in the `backend/` directory. All variables marked **required** must be set for the server to start.

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string. Format: `postgresql://user:pass@host:5432/dbname` |
| `JWT_SECRET` | ✅ | Secret key used to sign JWT tokens. Use a long random string (≥ 32 chars). |
| `PORT` | ❌ | HTTP port to listen on. Defaults to `3000`. |
| `FRONTEND_URL` | ✅ | The base URL of the frontend app, used for CORS and payment callbacks. E.g., `http://localhost:5173`. |
| `PAYSTACK_SECRET_KEY` | ❌ | Paystack secret key. If set to a string containing `mock`, payments are simulated and logged to console instead of hitting Paystack. |
| `AFRICAS_TALKING_API_KEY` | ❌ | Africa's Talking API key. If set to a string containing `mock`, SMS messages are printed to console instead of being sent. |
| `AFRICAS_TALKING_USERNAME` | ❌ | Africa's Talking username (default: `sandbox` for testing). |

**Example `.env`:**

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/agriconnect"
JWT_SECRET="supersecretjwttokenkey1234567890abcdef"
PORT=3000
FRONTEND_URL="http://localhost:5173"
PAYSTACK_SECRET_KEY="mock_sk_test_xxxx"
AFRICAS_TALKING_API_KEY="mock"
AFRICAS_TALKING_USERNAME="sandbox"
```

---

## Running Locally

```bash
# Development mode (hot-reload with ts-node-dev)
npm run dev

# Build the TypeScript source
npm run build

# Run the compiled output
npm start
```

The API will be available at `http://localhost:3000`. Confirm the server is healthy:

```bash
curl http://localhost:3000/health
```

---

## Database Migrations & Seeding

### Apply migrations

```bash
# Apply all pending migrations to the database
npx prisma migrate dev

# OR in production (no prompt, no dev features)
npx prisma migrate deploy
```

### Seed the database

Seeding creates a full realistic dataset: 10 farmers, 5 buyers, 3 transporters, 1 admin, 20 produce listings (including 3 near-spoilage listings expiring within 48 hours), 10 orders (5 DELIVERED, 2 IN_TRANSIT, 1 CONFIRMED, 1 PENDING, 1 CANCELLED), full trace event timelines, delivery requests, and 5 reviews.

```bash
npm run seed
```

Upon completion, a summary table is printed:

```
=============================================
📊 AGRICONNECT SEED DATA SUMMARY REPORT
=============================================
👤 Total Users Registered:      19
🍅 Total Produce Listings:      20
📦 Total Customer Orders:       10
📋 Total Trace Timeline Events:  XX
=============================================
```

### Inspect the database

```bash
npx prisma studio
```

---

## Running Tests

```bash
# Run the full test suite
npm test

# Run with coverage report
npm run test:coverage

# Run USSD dial simulation (interactive CLI)
npm run test:ussd
```

---

## Local USSD Testing

AgriConnect includes a CLI dial simulator that mimics Africa's Talking USSD session callbacks without needing a real handset. Use it to walk through the full USSD state machine locally.

```bash
npm run test:ussd
```

The simulator prompts you step-by-step, just like pressing digits on a phone. Example session:

```
Dial *384*1234#

[Level 0]
CON Welcome to AgriConnect
1. List Produce
2. My Listings
3. My Orders
4. Help

> 1

[Level 1 — Select Crop]
CON Select crop:
1. Tomato
2. Pepper
...
```

To test against a real Africa's Talking USSD sandbox, expose your local server with [ngrok](https://ngrok.com) and configure your sandbox callback URL:

```bash
ngrok http 3000
# Copy the HTTPS URL, then set it in Africa's Talking dashboard:
# Callback URL: https://xxxx.ngrok.io/api/ussd
```

---

## Africa's Talking Sandbox Setup

1. Register at [https://account.africastalking.com](https://account.africastalking.com) and create a **Sandbox** app.
2. Go to **USSD** → **Create Channel** and set the callback URL to your ngrok/server URL: `https://your-server/api/ussd`
3. Go to **SMS** → **Incoming Messages** and set the callback to: `https://your-server/api/sms`
4. Set your `.env`:
   ```env
   AFRICAS_TALKING_API_KEY="your-sandbox-api-key"
   AFRICAS_TALKING_USERNAME="sandbox"
   ```
5. Use the AT simulator to dial your USSD code and verify the responses.

> **Note:** If `AFRICAS_TALKING_API_KEY` contains the word `mock`, all SMS sends are simulated with `console.log` instead — no API calls are made. This is the default for local development.

---

## Endpoint Map

All routes are prefixed with `/api`.

### Auth (`/api/auth`)

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/request-otp` | Public | Request an OTP code for a phone number |
| `POST` | `/verify-otp` | Public | Verify OTP and receive a JWT token |
| `GET` | `/me` | 🔐 Any | Get current user profile |
| `PATCH` | `/profile` | 🔐 Any | Update current user profile |

### Listings (`/api/listings`)

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/` | Public | Search/filter produce listings (geo, crop, price, status) |
| `GET` | `/:id` | Public | Get a single listing by ID |
| `GET` | `/:id/qrcode` | Public | Get QR code PNG for a listing |
| `POST` | `/` | 🔐 FARMER | Create a new produce listing (multipart/form-data) |
| `PATCH` | `/:id` | 🔐 FARMER | Update a listing (ownership enforced) |
| `DELETE` | `/:id` | 🔐 FARMER | Soft- or hard-delete a listing (ownership enforced) |

**Listing search query params:** `cropType`, `status`, `minQuantityKg`, `maxPricePerKg`, `latitude`, `longitude`, `radiusKm`, `page`, `limit`

### Orders (`/api/orders`)

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/` | 🔐 BUYER | Place an order on a listing |
| `GET` | `/` | 🔐 Any | Get my orders (scoped by role: buyer or farmer) |
| `GET` | `/:id` | 🔐 Any | Get a single order (buyer or farmer only) |
| `PATCH` | `/:id/cancel` | 🔐 BUYER | Cancel a PENDING order |

### Deliveries (`/api/deliveries`)

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/available` | 🔐 TRANSPORT | List available delivery requests near transporter |
| `POST` | `/:id/accept` | 🔐 TRANSPORT | Accept a delivery request |
| `PATCH` | `/:id/status` | 🔐 TRANSPORT | Update delivery status (PICKED_UP, DELIVERED, etc.) |
| `GET` | `/estimate` | 🔐 Any | Estimate delivery cost by coordinates + weight |
| `GET` | `/:id/estimate` | 🔐 Any | Estimate cost for a specific delivery request |
| `GET` | `/:id` | 🔐 Any | Get delivery request by ID |

### Traceability (`/api/trace`)

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/:batchCode` | Public | Get full supply chain timeline for a batch |
| `GET` | `/:batchCode/qrcode` | Public | Get QR code PNG linking to the trace page |

### Payments (`/api/payments`)

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/initialize` | 🔐 BUYER | Initialize Paystack payment for an order |
| `GET` | `/:orderId/verify` | 🔐 Any | Manually verify/refresh payment status |
| `POST` | `/webhook` | Paystack | Paystack webhook (HMAC-verified, raw body) |

### Notifications (`/api/notifications`)

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/` | 🔐 Any | Get my notifications (paginated, with `unreadCount`) |
| `PATCH` | `/:id/read` | 🔐 Any | Mark a notification as read |
| `PATCH` | `/read-all` | 🔐 Any | Mark all notifications as read |

### Messages (`/api/messages`)

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/` | 🔐 Any | Send an in-app message to another user |
| `GET` | `/conversations` | 🔐 Any | List all conversations with unread counts |
| `GET` | `/conversations/:otherUserId` | 🔐 Any | Get paginated message thread with a user |

### Reviews (`/api/reviews`)

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/` | 🔐 Any | Submit a review for a delivered order |
| `GET` | `/user/:userId` | Public | Get all reviews received by a user |

### USSD & SMS (`/api/ussd`, `/api/sms`)

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/ussd` | Public | Africa's Talking USSD webhook callback |
| `POST` | `/api/sms` | Public | Africa's Talking inbound SMS webhook callback |

### Admin (`/api/admin`)

> All admin endpoints require `role = ADMIN`.

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/stats` | 🔐 ADMIN | Platform metrics: users, orders, GMV, spoilage risk |
| `GET` | `/users` | 🔐 ADMIN | List all users with filters (role, verified, search) |
| `PATCH` | `/users/:id/verify` | 🔐 ADMIN | Mark a user as verified |
| `GET` | `/trace/:batchCode` | 🔐 ADMIN | Unredacted trace timeline (includes all contact info) |
| `DELETE` | `/listings/:id` | 🔐 ADMIN | Hard-delete any listing regardless of owner |
| `POST` | `/delivery-requests/group` | 🔐 ADMIN | Manually trigger delivery route grouping algorithm |

### Utility

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check — returns `{ status: "ok", timestamp }` |

---

## Architecture Notes

### Rate Limiting

- **Global**: 100 requests per 15 minutes per IP (applied to all routes)
- **OTP endpoint**: Stricter 5 requests per 15 minutes per IP on `POST /api/auth/request-otp`

### File Uploads

Multipart uploads for listing images are accepted at `POST /api/listings`. Rules:
- Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`
- Max file size: **5 MB** per image
- Max images per upload: **5**
- Files are stored at `uploads/{userId}/{timestamp}-{random}.{ext}`

### Payment Webhook

The Paystack webhook at `POST /api/payments/webhook` is mounted **before** the global `express.json()` middleware, using `express.raw({ type: 'application/json' })` to preserve the raw request buffer required for SHA-512 HMAC signature verification.

### Validation

Every route that accepts a body, query params, or URL params validates them with a Zod schema via the reusable `validate(schema, target)` middleware. Validation failures return:

```json
{
  "error": {
    "message": "Validation failed",
    "fields": [
      { "field": "quantityKg", "message": "Quantity must be greater than zero" }
    ]
  }
}
```

### Mock Mode

Both Paystack and Africa's Talking integrations fall back to console logging (no real HTTP calls) when their respective API keys contain the substring `mock`. This lets you run the entire server locally without any external credentials.

---

## Scheduled Jobs

AgriConnect uses scheduled background processes to calculate crop spoilage risk scores, trigger auto flash sales, and manage stale claims/listings.

### Recommended Production Cron Schedules
- **Risk Scoring Job**: Run every 2 hours (`0 */2 * * *`)
  - Evaluates active produce listings, updates current spoilage risk levels, and automatically lists high-risk crops at discounted flash prices.
- **Expiry Job**: Run every 15 minutes (`*/15 * * * *`)
  - Clears stale pending reservations/claims, terminates expired flash sale campaigns, and auto-expires old listings.

### Triggering Jobs manually (MVP Demo)
For the MVP, these jobs are exposed as endpoints to trigger manually:
- **POST `/api/jobs/risk-scoring`** (Admin / SuperAdmin)
- **POST `/api/jobs/expiry`** (Admin / SuperAdmin)
- **GET `/api/jobs/risk-scoring/status`** (SuperAdmin telemetry)

### Production Setup
For production deployments, install `node-cron` or configure a dedicated worker/scheduler process:
```typescript
import cron from 'node-cron';
import { SpoilageJobService } from './services/flashsale/spoilageJob.service';

// Calculate risk levels and auto-trigger sales every 2 hours
cron.schedule('0 */2 * * *', () => SpoilageJobService.runRiskScoringJob());

// Release claims and expire listings every 15 minutes
cron.schedule('*/15 * * * *', () => SpoilageJobService.runExpiryJob());
```
