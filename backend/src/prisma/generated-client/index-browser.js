
Object.defineProperty(exports, "__esModule", { value: true });

const {
  Decimal,
  objectEnumValues,
  makeStrictEnum,
  Public,
  getRuntime,
  skip
} = require('./runtime/index-browser.js')


const Prisma = {}

exports.Prisma = Prisma
exports.$Enums = {}

/**
 * Prisma Client JS version: 5.22.0
 * Query Engine version: 605197351a3c8bdd595af2d2a9bc3025bca48ea2
 */
Prisma.prismaVersion = {
  client: "5.22.0",
  engine: "605197351a3c8bdd595af2d2a9bc3025bca48ea2"
}

Prisma.PrismaClientKnownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientKnownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)};
Prisma.PrismaClientUnknownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientUnknownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientRustPanicError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientRustPanicError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientInitializationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientInitializationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientValidationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientValidationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.NotFoundError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`NotFoundError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`sqltag is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.empty = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`empty is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.join = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`join is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.raw = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`raw is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.getExtensionContext is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.defineExtension = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.defineExtension is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}

/**
 * Shorthand utilities for JSON filtering
 */
Prisma.DbNull = objectEnumValues.instances.DbNull
Prisma.JsonNull = objectEnumValues.instances.JsonNull
Prisma.AnyNull = objectEnumValues.instances.AnyNull

Prisma.NullTypes = {
  DbNull: objectEnumValues.classes.DbNull,
  JsonNull: objectEnumValues.classes.JsonNull,
  AnyNull: objectEnumValues.classes.AnyNull
}



/**
 * Enums
 */

exports.Prisma.TransactionIsolationLevel = makeStrictEnum({
  ReadUncommitted: 'ReadUncommitted',
  ReadCommitted: 'ReadCommitted',
  RepeatableRead: 'RepeatableRead',
  Serializable: 'Serializable'
});

exports.Prisma.UserScalarFieldEnum = {
  id: 'id',
  phone: 'phone',
  name: 'name',
  role: 'role',
  latitude: 'latitude',
  longitude: 'longitude',
  region: 'region',
  district: 'district',
  isVerified: 'isVerified',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.FarmerProfileScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  farmSizeAcres: 'farmSizeAcres',
  primaryCrops: 'primaryCrops',
  avgRating: 'avgRating',
  totalReviews: 'totalReviews',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.BuyerProfileScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  businessType: 'businessType',
  avgRating: 'avgRating',
  totalReviews: 'totalReviews',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.TransportProfileScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  vehicleType: 'vehicleType',
  capacityKg: 'capacityKg',
  serviceRadiusKm: 'serviceRadiusKm',
  isAvailable: 'isAvailable',
  avgRating: 'avgRating',
  totalReviews: 'totalReviews',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ProduceListingScalarFieldEnum = {
  id: 'id',
  farmerId: 'farmerId',
  cropType: 'cropType',
  quantityKg: 'quantityKg',
  remainingKg: 'remainingKg',
  pricePerKg: 'pricePerKg',
  images: 'images',
  harvestDate: 'harvestDate',
  expiryEstimate: 'expiryEstimate',
  qualityGrade: 'qualityGrade',
  qualityGradeSource: 'qualityGradeSource',
  status: 'status',
  latitude: 'latitude',
  longitude: 'longitude',
  batchCode: 'batchCode',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  plantingLogId: 'plantingLogId'
};

exports.Prisma.TraceabilityRecordScalarFieldEnum = {
  id: 'id',
  listingId: 'listingId',
  plantingDate: 'plantingDate',
  inputsUsed: 'inputsUsed',
  qualityCheckImages: 'qualityCheckImages',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.TraceEventScalarFieldEnum = {
  id: 'id',
  listingId: 'listingId',
  eventType: 'eventType',
  latitude: 'latitude',
  longitude: 'longitude',
  recordedByUserId: 'recordedByUserId',
  notes: 'notes',
  timestamp: 'timestamp',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.OrderScalarFieldEnum = {
  id: 'id',
  buyerId: 'buyerId',
  listingId: 'listingId',
  quantityKg: 'quantityKg',
  totalPrice: 'totalPrice',
  status: 'status',
  paymentStatus: 'paymentStatus',
  paystackReference: 'paystackReference',
  depositCredit: 'depositCredit',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.DeliveryRequestScalarFieldEnum = {
  id: 'id',
  orderId: 'orderId',
  transportProviderId: 'transportProviderId',
  pickupLatitude: 'pickupLatitude',
  pickupLongitude: 'pickupLongitude',
  dropoffLatitude: 'dropoffLatitude',
  dropoffLongitude: 'dropoffLongitude',
  scheduledPickup: 'scheduledPickup',
  scheduledDropoff: 'scheduledDropoff',
  estimatedCost: 'estimatedCost',
  status: 'status',
  routeGroupId: 'routeGroupId',
  routeSequence: 'routeSequence',
  eta: 'eta',
  currentLatitude: 'currentLatitude',
  currentLongitude: 'currentLongitude',
  routeDistanceKm: 'routeDistanceKm',
  routeDurationMin: 'routeDurationMin',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ReviewScalarFieldEnum = {
  id: 'id',
  fromUserId: 'fromUserId',
  toUserId: 'toUserId',
  orderId: 'orderId',
  rating: 'rating',
  comment: 'comment',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.NotificationScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  type: 'type',
  message: 'message',
  isRead: 'isRead',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.MessageScalarFieldEnum = {
  id: 'id',
  fromUserId: 'fromUserId',
  toUserId: 'toUserId',
  orderId: 'orderId',
  content: 'content',
  isRead: 'isRead',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.OtpCodeScalarFieldEnum = {
  id: 'id',
  phone: 'phone',
  code: 'code',
  expiresAt: 'expiresAt',
  isUsed: 'isUsed',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.UssdSessionScalarFieldEnum = {
  id: 'id',
  sessionId: 'sessionId',
  phone: 'phone',
  currentStep: 'currentStep',
  tempData: 'tempData',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PreOrderScalarFieldEnum = {
  id: 'id',
  buyerId: 'buyerId',
  cropType: 'cropType',
  quantityKg: 'quantityKg',
  maxPricePerKg: 'maxPricePerKg',
  preferredRegion: 'preferredRegion',
  harvestWindowStart: 'harvestWindowStart',
  harvestWindowEnd: 'harvestWindowEnd',
  notes: 'notes',
  depositAmount: 'depositAmount',
  depositPaid: 'depositPaid',
  paystackReference: 'paystackReference',
  status: 'status',
  matchedListingId: 'matchedListingId',
  fulfilledOrderId: 'fulfilledOrderId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PlantingLogScalarFieldEnum = {
  id: 'id',
  farmerId: 'farmerId',
  cropType: 'cropType',
  acreage: 'acreage',
  plantingDate: 'plantingDate',
  expectedHarvestDate: 'expectedHarvestDate',
  actualHarvestDate: 'actualHarvestDate',
  actualYieldKg: 'actualYieldKg',
  notes: 'notes',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PlantingInputScalarFieldEnum = {
  id: 'id',
  plantingLogId: 'plantingLogId',
  type: 'type',
  name: 'name',
  quantity: 'quantity',
  unit: 'unit',
  appliedAt: 'appliedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.NullableJsonNullValueInput = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull
};

exports.Prisma.QueryMode = {
  default: 'default',
  insensitive: 'insensitive'
};

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last'
};

exports.Prisma.JsonNullValueFilter = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull,
  AnyNull: Prisma.AnyNull
};
exports.Role = exports.$Enums.Role = {
  FARMER: 'FARMER',
  BUYER: 'BUYER',
  TRANSPORT: 'TRANSPORT',
  ADMIN: 'ADMIN'
};

exports.BusinessType = exports.$Enums.BusinessType = {
  RETAILER: 'RETAILER',
  RESTAURANT: 'RESTAURANT',
  PROCESSOR: 'PROCESSOR',
  EXPORTER: 'EXPORTER',
  HOUSEHOLD: 'HOUSEHOLD'
};

exports.CropType = exports.$Enums.CropType = {
  TOMATO: 'TOMATO',
  PEPPER: 'PEPPER',
  GARDEN_EGG: 'GARDEN_EGG',
  OKRA: 'OKRA',
  LEAFY_GREENS: 'LEAFY_GREENS',
  OTHER: 'OTHER'
};

exports.QualityGrade = exports.$Enums.QualityGrade = {
  A: 'A',
  B: 'B',
  C: 'C',
  UNGRADED: 'UNGRADED'
};

exports.ListingStatus = exports.$Enums.ListingStatus = {
  AVAILABLE: 'AVAILABLE',
  RESERVED: 'RESERVED',
  SOLD_OUT: 'SOLD_OUT',
  EXPIRED: 'EXPIRED'
};

exports.TraceEventType = exports.$Enums.TraceEventType = {
  HARVESTED: 'HARVESTED',
  LISTED: 'LISTED',
  QUALITY_CHECKED: 'QUALITY_CHECKED',
  RESERVED: 'RESERVED',
  PICKED_UP: 'PICKED_UP',
  IN_TRANSIT: 'IN_TRANSIT',
  DELIVERED: 'DELIVERED'
};

exports.OrderStatus = exports.$Enums.OrderStatus = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  IN_TRANSIT: 'IN_TRANSIT',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED'
};

exports.PaymentStatus = exports.$Enums.PaymentStatus = {
  UNPAID: 'UNPAID',
  PAID: 'PAID',
  REFUNDED: 'REFUNDED'
};

exports.DeliveryStatus = exports.$Enums.DeliveryStatus = {
  REQUESTED: 'REQUESTED',
  MATCHED: 'MATCHED',
  PICKED_UP: 'PICKED_UP',
  DELIVERED: 'DELIVERED'
};

exports.PreOrderStatus = exports.$Enums.PreOrderStatus = {
  DEPOSIT_PENDING: 'DEPOSIT_PENDING',
  OPEN: 'OPEN',
  MATCHED: 'MATCHED',
  FULFILLED: 'FULFILLED',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED'
};

exports.Prisma.ModelName = {
  User: 'User',
  FarmerProfile: 'FarmerProfile',
  BuyerProfile: 'BuyerProfile',
  TransportProfile: 'TransportProfile',
  ProduceListing: 'ProduceListing',
  TraceabilityRecord: 'TraceabilityRecord',
  TraceEvent: 'TraceEvent',
  Order: 'Order',
  DeliveryRequest: 'DeliveryRequest',
  Review: 'Review',
  Notification: 'Notification',
  Message: 'Message',
  OtpCode: 'OtpCode',
  UssdSession: 'UssdSession',
  PreOrder: 'PreOrder',
  PlantingLog: 'PlantingLog',
  PlantingInput: 'PlantingInput'
};

/**
 * This is a stub Prisma Client that will error at runtime if called.
 */
class PrismaClient {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        let message
        const runtime = getRuntime()
        if (runtime.isEdge) {
          message = `PrismaClient is not configured to run in ${runtime.prettyName}. In order to run Prisma Client on edge runtime, either:
- Use Prisma Accelerate: https://pris.ly/d/accelerate
- Use Driver Adapters: https://pris.ly/d/driver-adapters
`;
        } else {
          message = 'PrismaClient is unable to run in this browser environment, or has been bundled for the browser (running in `' + runtime.prettyName + '`).'
        }
        
        message += `
If this is unexpected, please open an issue: https://pris.ly/prisma-prisma-bug-report`

        throw new Error(message)
      }
    })
  }
}

exports.PrismaClient = PrismaClient

Object.assign(exports, Prisma)
