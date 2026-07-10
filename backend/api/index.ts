import app from '../src/app';
import { RuntimeConfig } from '../src/config/runtimeConfig';

// Initialize runtime config on cold start
RuntimeConfig.init().catch(console.error);

export default app;
