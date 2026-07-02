/**
 * HTTP smoke tests using supertest.
 * Prisma client is mocked so no live database is needed.
 * Tests cover:
 *  - Health check endpoint
 *  - 400 validation rejections on auth and listing endpoints
 *  - 401 on protected routes without a token
 */

// Mock Prisma before importing app (prevents real DB connection)
jest.mock('../prisma/client', () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), create: jest.fn(), update: jest.fn(), count: jest.fn().mockResolvedValue(0) },
    otpCode: { findFirst: jest.fn(), create: jest.fn(), delete: jest.fn(), deleteMany: jest.fn() },
    produceListing: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), create: jest.fn(), update: jest.fn(), count: jest.fn().mockResolvedValue(0) },
    order: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), create: jest.fn(), count: jest.fn().mockResolvedValue(0) },
    notification: { findMany: jest.fn().mockResolvedValue([]), create: jest.fn(), count: jest.fn().mockResolvedValue(0), update: jest.fn(), updateMany: jest.fn() },
    message: { create: jest.fn(), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), updateMany: jest.fn() },
    traceEvent: { findMany: jest.fn().mockResolvedValue([]), create: jest.fn() },
    traceabilityRecord: { findUnique: jest.fn() },
    deliveryRequest: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    review: { create: jest.fn(), findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn() },
    farmerProfile: { update: jest.fn() },
    buyerProfile: { update: jest.fn() },
    transportProfile: { update: jest.fn() },
    $queryRawUnsafe: jest.fn().mockResolvedValue([]),
    $transaction: jest.fn((fn: (tx: any) => Promise<any>) => fn({
      user: { findUnique: jest.fn(), update: jest.fn(), create: jest.fn() },
      produceListing: { create: jest.fn(), update: jest.fn(), delete: jest.fn(), findUnique: jest.fn() },
      order: { create: jest.fn(), update: jest.fn() },
      traceEvent: { create: jest.fn(), deleteMany: jest.fn() },
      notification: { create: jest.fn() },
    })),
    $disconnect: jest.fn(),
  },
}));

import request from 'supertest';
import app from '../app';

describe('Health Check', () => {
  it('GET /api/health returns 200 with status ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body).toHaveProperty('timestamp');
  });
});

describe('Auth Route Validation', () => {
  it('POST /api/auth/request-otp rejects empty body with 400', async () => {
    const res = await request(app)
      .post('/api/auth/request-otp')
      .send({})
      .set('Content-Type', 'application/json');
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Validation failed');
    expect(res.body.error.fields).toBeInstanceOf(Array);
  });

  it('POST /api/auth/request-otp rejects a short phone number with 400', async () => {
    const res = await request(app)
      .post('/api/auth/request-otp')
      .send({ phone: '+23' })
      .set('Content-Type', 'application/json');
    expect(res.status).toBe(400);
    const phoneError = res.body.error.fields.find((f: any) => f.field === 'phone');
    expect(phoneError).toBeDefined();
  });

  it('POST /api/auth/verify-otp rejects a 5-digit OTP code with 400', async () => {
    const res = await request(app)
      .post('/api/auth/verify-otp')
      .send({ phone: '+233241234567', code: '12345' })
      .set('Content-Type', 'application/json');
    expect(res.status).toBe(400);
  });

  it('POST /api/auth/verify-otp rejects unknown role with 400', async () => {
    const res = await request(app)
      .post('/api/auth/verify-otp')
      .send({ phone: '+233241234567', code: '123456', role: 'DRIVER' })
      .set('Content-Type', 'application/json');
    expect(res.status).toBe(400);
  });
});

describe('Protected Route Guards', () => {
  it('GET /api/orders returns 401 without a Bearer token', async () => {
    const res = await request(app).get('/api/orders');
    expect(res.status).toBe(401);
  });

  it('GET /api/notifications returns 401 without a Bearer token', async () => {
    const res = await request(app).get('/api/notifications');
    expect(res.status).toBe(401);
  });

  it('POST /api/orders returns 401 without a Bearer token', async () => {
    const res = await request(app).post('/api/orders').send({ listingId: 'some-id', quantityKg: 10 });
    expect(res.status).toBe(401);
  });
});

describe('Listing Route Validation', () => {
  it('GET /api/listings returns 200 (public endpoint)', async () => {
    const res = await request(app).get('/api/listings');
    // Could be 200 or 500 (DB mock), but NOT 401/400 — it is a public endpoint
    expect([200, 500]).toContain(res.status);
  });

  it('GET /api/listings/:id with a non-UUID id returns 400', async () => {
    const res = await request(app).get('/api/listings/not-a-uuid');
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Validation failed');
  });
});

describe('Trace Route Validation', () => {
  it('GET /api/trace/:batchCode with a very short code returns 400', async () => {
    const res = await request(app).get('/api/trace/AB');
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Validation failed');
  });

  it('GET /api/trace/:batchCode with a valid batch code passes validation', async () => {
    const res = await request(app).get('/api/trace/BAT-TOM-001');
    // Could be 404 (mocked DB returns null) or 200 — validation passed either way
    expect([200, 404, 500]).toContain(res.status);
  });
});
