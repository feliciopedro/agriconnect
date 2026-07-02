import { Router } from 'express';
import { ListingController } from '../controllers/listing.controller';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';
import { uploadImages } from '../middleware/upload.middleware';
import { validate } from '../middleware/validation.middleware';
import { CreateListingSchema, UpdateListingSchema } from '../types/listing.schema';
import { Role } from '../prisma/generated-client';

const router = Router();

// Publicly accessible queries
router.get('/', ListingController.searchListings);
router.get('/:id', ListingController.getListingById);
router.get('/:id/qrcode', ListingController.getListingQrCode);

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
  validate(UpdateListingSchema),
  ListingController.updateListing
);

router.delete(
  '/:id',
  authenticateToken,
  requireRole(Role.FARMER),
  ListingController.deleteListing
);

export default router;
