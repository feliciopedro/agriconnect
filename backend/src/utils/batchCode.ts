import { CropType } from '../prisma/generated-client';

/**
 * Maps CropType enum values to their 3-letter abbreviation.
 */
export const getCropAbbreviation = (cropType: CropType): string => {
  switch (cropType) {
    case CropType.TOMATO:
      return 'TOM';
    case CropType.PEPPER:
      return 'PEP';
    case CropType.GARDEN_EGG:
      return 'GEG';
    case CropType.OKRA:
      return 'OKR';
    case CropType.LEAFY_GREENS:
      return 'LFG';
    default:
      return 'OTH';
  }
};

/**
 * Generates a unique batch code in format:
 * AGC-{CROP_ABBR}-{YYYYMMDD}-{4 uppercase random alphanumeric characters}
 */
export const generateBatchCode = (cropType: CropType): string => {
  const abbr = getCropAbbreviation(cropType);
  
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;
  
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let randStr = '';
  for (let i = 0; i < 4; i++) {
    randStr += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return `AGC-${abbr}-${dateStr}-${randStr}`;
};
