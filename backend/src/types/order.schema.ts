import { z } from 'zod';

/**
 * Validator schema for creating a new purchase order.
 */
export const CreateOrderSchema = z.object({
  listingId: z.string().uuid('Invalid listing identifier. Must be a valid UUID.'),
  quantityKg: z.preprocess(
    (val) => (typeof val === 'string' ? parseFloat(val) : val),
    z.number().positive('Quantity must be greater than zero')
  ),
});
