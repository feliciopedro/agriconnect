import { z } from 'zod';

export const SendMessageSchema = z.object({
  receiverId: z.string().uuid('Invalid receiver user identifier. Must be a valid UUID.'),
  content: z.string().min(1, 'Content cannot be empty').max(2000, 'Content cannot exceed 2000 characters'),
  orderId: z.string().uuid('Invalid order identifier. Must be a valid UUID.').optional(),
});

export const GetConversationParamsSchema = z.object({
  otherUserId: z.string().uuid('Invalid other user identifier. Must be a valid UUID.'),
});
