import { z } from 'zod';

export const ExportOrdersQuerySchema = z.object({
  startDate: z.string().datetime({ message: 'startDate must be a valid ISO date string' }).optional(),
  endDate: z.string().datetime({ message: 'endDate must be a valid ISO date string' }).optional(),
});
