/**
 * Logistics and Delivery pricing configurations.
 */
export const LogisticsConfig = {
  // Base flag rate in GHS
  BASE_FEE: 15.0,
  
  // Rate per kilometer in GHS
  RATE_PER_KM: 2.5,
  
  // Weight threshold in kg after which surcharges are applied
  WEIGHT_SURCHARGE_LIMIT: 200.0,
  
  // Cost per kg exceeding the surcharge weight limit (GHS/kg)
  WEIGHT_SURCHARGE_RATE: 0.05,
};
