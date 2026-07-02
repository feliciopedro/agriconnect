import { z } from 'zod';
import { TraceEventType } from '../prisma/generated-client';

const TraceEventTypeEnum = z.nativeEnum(TraceEventType);

/**
 * Validator schema for admin trace event manual insertions.
 */
export const AdminTraceEventSchema = z.object({
  eventType: TraceEventTypeEnum,
  notes: z.string().min(2, 'Notes must contain at least 2 characters.'),
});
