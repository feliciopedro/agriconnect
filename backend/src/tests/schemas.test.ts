/**
 * Unit tests for all Zod validation schemas.
 * No database or HTTP required — pure schema parsing.
 */
import { RequestOtpSchema, VerifyOtpSchema, UpdateProfileSchema } from '../types/auth.schema';
import { CreateListingSchema, UpdateListingSchema } from '../types/listing.schema';
import { CreateOrderSchema } from '../types/order.schema';
import { CreateReviewSchema } from '../types/review.schema';
import { SendMessageSchema } from '../types/message.schema';
import { UpdateDeliveryStatusSchema } from '../types/delivery.schema';
import { AdminTraceEventSchema, BatchCodeParamSchema } from '../types/trace.schema';

describe('Auth Schemas', () => {
  describe('RequestOtpSchema', () => {
    it('accepts a valid phone number', () => {
      const result = RequestOtpSchema.safeParse({ phone: '+233241234567' });
      expect(result.success).toBe(true);
    });

    it('rejects a phone number that is too short', () => {
      const result = RequestOtpSchema.safeParse({ phone: '+23324' });
      expect(result.success).toBe(false);
    });

    it('rejects missing phone field', () => {
      const result = RequestOtpSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('VerifyOtpSchema', () => {
    it('accepts valid phone, code and no role', () => {
      const result = VerifyOtpSchema.safeParse({ phone: '+233241234567', code: '123456' });
      expect(result.success).toBe(true);
    });

    it('accepts valid phone, code, and a known role', () => {
      const result = VerifyOtpSchema.safeParse({ phone: '+233241234567', code: '123456', role: 'FARMER' });
      expect(result.success).toBe(true);
    });

    it('rejects code that is not 6 characters', () => {
      const result = VerifyOtpSchema.safeParse({ phone: '+233241234567', code: '12345' });
      expect(result.success).toBe(false);
    });

    it('rejects unknown role', () => {
      const result = VerifyOtpSchema.safeParse({ phone: '+233241234567', code: '123456', role: 'DRIVER' });
      expect(result.success).toBe(false);
    });
  });

  describe('UpdateProfileSchema', () => {
    it('accepts an empty patch (all fields optional)', () => {
      const result = UpdateProfileSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('accepts a partial update', () => {
      const result = UpdateProfileSchema.safeParse({ name: 'Kwame Boateng', region: 'Eastern' });
      expect(result.success).toBe(true);
    });

    it('rejects latitude outside -90 to 90', () => {
      const result = UpdateProfileSchema.safeParse({ latitude: 91 });
      expect(result.success).toBe(false);
    });
  });
});

describe('Listing Schemas', () => {
  const validListing = {
    cropType: 'TOMATO',
    quantityKg: 150,
    pricePerKg: 4.5,
    harvestDate: new Date().toISOString(),
    expiryEstimate: new Date().toISOString(),
    qualityGrade: 'A',
    latitude: 6.0945,
    longitude: -0.2591,
  };

  describe('CreateListingSchema', () => {
    it('accepts a valid listing payload', () => {
      const result = CreateListingSchema.safeParse(validListing);
      expect(result.success).toBe(true);
    });

    it('rejects negative quantity', () => {
      const result = CreateListingSchema.safeParse({ ...validListing, quantityKg: -5 });
      expect(result.success).toBe(false);
    });

    it('rejects invalid cropType', () => {
      const result = CreateListingSchema.safeParse({ ...validListing, cropType: 'MANGO' });
      expect(result.success).toBe(false);
    });

    it('rejects invalid qualityGrade', () => {
      const result = CreateListingSchema.safeParse({ ...validListing, qualityGrade: 'Z' });
      expect(result.success).toBe(false);
    });

    it('accepts string quantity (coerced from form-data)', () => {
      const result = CreateListingSchema.safeParse({ ...validListing, quantityKg: '100', pricePerKg: '4.5' });
      expect(result.success).toBe(true);
    });
  });

  describe('UpdateListingSchema', () => {
    it('accepts an empty partial update', () => {
      const result = UpdateListingSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('accepts a price-only update', () => {
      const result = UpdateListingSchema.safeParse({ pricePerKg: 5.5 });
      expect(result.success).toBe(true);
    });
  });
});

describe('Order Schemas', () => {
  describe('CreateOrderSchema', () => {
    it('accepts valid listingId and quantity', () => {
      const result = CreateOrderSchema.safeParse({
        listingId: '123e4567-e89b-12d3-a456-426614174000',
        quantityKg: 50,
      });
      expect(result.success).toBe(true);
    });

    it('rejects non-UUID listingId', () => {
      const result = CreateOrderSchema.safeParse({ listingId: 'not-a-uuid', quantityKg: 50 });
      expect(result.success).toBe(false);
    });

    it('rejects zero or negative quantity', () => {
      const result = CreateOrderSchema.safeParse({
        listingId: '123e4567-e89b-12d3-a456-426614174000',
        quantityKg: 0,
      });
      expect(result.success).toBe(false);
    });

    it('accepts string quantity (form-data coercion)', () => {
      const result = CreateOrderSchema.safeParse({
        listingId: '123e4567-e89b-12d3-a456-426614174000',
        quantityKg: '30',
      });
      expect(result.success).toBe(true);
    });
  });
});

describe('Review Schemas', () => {
  describe('CreateReviewSchema', () => {
    const validReview = {
      toUserId: '123e4567-e89b-12d3-a456-426614174000',
      orderId: '123e4567-e89b-12d3-a456-426614174001',
      rating: 5,
    };

    it('accepts a valid review', () => {
      const result = CreateReviewSchema.safeParse(validReview);
      expect(result.success).toBe(true);
    });

    it('accepts rating 1', () => {
      const result = CreateReviewSchema.safeParse({ ...validReview, rating: 1 });
      expect(result.success).toBe(true);
    });

    it('rejects rating 0', () => {
      const result = CreateReviewSchema.safeParse({ ...validReview, rating: 0 });
      expect(result.success).toBe(false);
    });

    it('rejects rating 6', () => {
      const result = CreateReviewSchema.safeParse({ ...validReview, rating: 6 });
      expect(result.success).toBe(false);
    });

    it('rejects non-UUID toUserId', () => {
      const result = CreateReviewSchema.safeParse({ ...validReview, toUserId: 'bad-id' });
      expect(result.success).toBe(false);
    });
  });
});

describe('Message Schemas', () => {
  describe('SendMessageSchema', () => {
    it('accepts a valid message', () => {
      const result = SendMessageSchema.safeParse({
        receiverId: '123e4567-e89b-12d3-a456-426614174000',
        content: 'Hello, is the tomato still available?',
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty content', () => {
      const result = SendMessageSchema.safeParse({
        toUserId: '123e4567-e89b-12d3-a456-426614174000',
        content: '',
      });
      expect(result.success).toBe(false);
    });
  });
});

describe('Delivery Schemas', () => {
  describe('UpdateDeliveryStatusSchema', () => {
    it('accepts a valid delivery status', () => {
      const result = UpdateDeliveryStatusSchema.safeParse({ status: 'PICKED_UP' });
      expect(result.success).toBe(true);
    });

    it('rejects unknown status', () => {
      const result = UpdateDeliveryStatusSchema.safeParse({ status: 'FLYING' });
      expect(result.success).toBe(false);
    });
  });
});

describe('Trace Schemas', () => {
  describe('BatchCodeParamSchema', () => {
    it('accepts a valid batch code', () => {
      const result = BatchCodeParamSchema.safeParse({ batchCode: 'BAT-TOM-001' });
      expect(result.success).toBe(true);
    });

    it('rejects a code shorter than 5 chars', () => {
      const result = BatchCodeParamSchema.safeParse({ batchCode: 'B1' });
      expect(result.success).toBe(false);
    });
  });

  describe('AdminTraceEventSchema', () => {
    it('accepts a valid trace event', () => {
      const result = AdminTraceEventSchema.safeParse({ eventType: 'QUALITY_CHECKED', notes: 'Quality check passed.' });
      expect(result.success).toBe(true);
    });

    it('rejects a note shorter than 2 characters', () => {
      const result = AdminTraceEventSchema.safeParse({ eventType: 'INSPECTED', notes: 'X' });
      expect(result.success).toBe(false);
    });
  });
});
