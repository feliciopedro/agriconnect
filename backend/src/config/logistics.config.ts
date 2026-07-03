import { RuntimeConfig } from './runtimeConfig';

/**
 * Logistics and Delivery pricing configurations.
 */
export const LogisticsConfig = {
  // Base flag rate in GHS
  get BASE_FEE() {
    return RuntimeConfig.getNumber('delivery_base_fee_ghs', 15.0);
  },
  
  // Rate per kilometer in GHS
  get RATE_PER_KM() {
    return RuntimeConfig.getNumber('delivery_rate_per_km', 2.5);
  },
  
  // Weight threshold in kg after which surcharges are applied
  get WEIGHT_SURCHARGE_LIMIT() {
    return RuntimeConfig.getNumber('weight_surcharge_limit', 200.0);
  },
  
  // Cost per kg exceeding the surcharge weight limit (GHS/kg)
  get WEIGHT_SURCHARGE_RATE() {
    return RuntimeConfig.getNumber('weight_surcharge_rate', 0.05);
  },
};
