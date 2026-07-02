/**
 * Unit tests for the reusable validate() middleware.
 * Uses mock Request/Response/NextFunction objects — no database or HTTP required.
 */
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.middleware';

function mockReq(overrides: Partial<Request> = {}): Partial<Request> {
  return { body: {}, query: {}, params: {}, ...overrides };
}

function mockRes(): { status: jest.Mock; json: jest.Mock } {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res;
}

describe('validate middleware', () => {
  const schema = z.object({
    name: z.string().min(2),
    age: z.number().int().positive(),
  });

  it('calls next() when body is valid', () => {
    const req = mockReq({ body: { name: 'Kwame', age: 30 } });
    const res = mockRes();
    const next = jest.fn();

    validate(schema)(req as Request, res as unknown as Response, next as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 400 with field errors when body is invalid', () => {
    const req = mockReq({ body: { name: 'K', age: -1 } });
    const res = mockRes();
    const next = jest.fn();

    validate(schema)(req as Request, res as unknown as Response, next as NextFunction);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    const jsonArg = res.json.mock.calls[0][0];
    expect(jsonArg.error.message).toBe('Validation failed');
    expect(jsonArg.error.fields.length).toBeGreaterThan(0);
  });

  it('returns 400 when body is completely missing fields', () => {
    const req = mockReq({ body: {} });
    const res = mockRes();
    const next = jest.fn();

    validate(schema)(req as Request, res as unknown as Response, next as NextFunction);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('validates params target instead of body', () => {
    const paramSchema = z.object({ id: z.string().uuid() });
    const req = mockReq({ params: { id: 'not-a-uuid' } as any });
    const res = mockRes();
    const next = jest.fn();

    validate(paramSchema, 'params')(req as Request, res as unknown as Response, next as NextFunction);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('validates query target', () => {
    const querySchema = z.object({ page: z.string().regex(/^\d+$/) });
    const req = mockReq({ query: { page: 'abc' } as any });
    const res = mockRes();
    const next = jest.fn();

    validate(querySchema, 'query')(req as Request, res as unknown as Response, next as NextFunction);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('assigns parsed data back to req.body after successful validation', () => {
    const req = mockReq({ body: { name: 'Ama', age: 25 } });
    const res = mockRes();
    const next = jest.fn();

    validate(schema)(req as Request, res as unknown as Response, next as NextFunction);

    expect((req as any).body).toEqual({ name: 'Ama', age: 25 });
    expect(next).toHaveBeenCalled();
  });

  it('field error message references the correct field path', () => {
    const req = mockReq({ body: { name: 'Kwame', age: 'not-a-number' } });
    const res = mockRes();
    const next = jest.fn();

    validate(schema)(req as Request, res as unknown as Response, next as NextFunction);

    const fields: { field: string; message: string }[] = res.json.mock.calls[0][0].error.fields;
    const ageError = fields.find((f) => f.field === 'age');
    expect(ageError).toBeDefined();
  });
});
