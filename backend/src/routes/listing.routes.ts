import { Router } from 'express';
import { ListingController } from '../controllers/listing.controller';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';
import { uploadImages } from '../middleware/upload.middleware';
import { validate } from '../middleware/validate.middleware';
import { CreateListingSchema, UpdateListingSchema, ListingIdParamSchema } from '../types/listing.schema';
import { Role } from '../prisma/generated-client';

const router = Router();

// Publicly accessible queries
router.get('/', ListingController.searchListings);
router.get('/:id', validate(ListingIdParamSchema, 'params'), ListingController.getListingById);
router.get('/:id/qrcode', validate(ListingIdParamSchema, 'params'), ListingController.getListingQrCode);
router.get('/:id/trace-label', validate(ListingIdParamSchema, 'params'), ListingController.getTraceLabel);

// Farmer protected modification routes
router.post(
  '/',
  authenticateToken,
  requireRole(Role.FARMER),
  uploadImages,
  validate(CreateListingSchema),
  ListingController.createListing
);

router.patch(
  '/:id',
  authenticateToken,
  requireRole(Role.FARMER),
  validate(ListingIdParamSchema, 'params'),
  validate(UpdateListingSchema),
  ListingController.updateListing
);

router.delete(
  '/:id',
  authenticateToken,
  requireRole(Role.FARMER),
  validate(ListingIdParamSchema, 'params'),
  ListingController.deleteListing
);

export default router;
