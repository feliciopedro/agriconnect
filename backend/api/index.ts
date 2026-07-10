import type { VercelRequest, VercelResponse } from '@vercel/node';

let app: any;
let initError: Error | null = null;

try {
  // Dynamically require the Express app. If any module-level import
  // fails (e.g. missing env vars, Prisma engine not found), we capture
  // the error and surface it as a 500 JSON response instead of a
  // silent FUNCTION_INVOCATION_FAILED crash.
  app = require('../src/app').default;

  // Fire-and-forget runtime config initialisation
  const { RuntimeConfig } = require('../src/config/runtimeConfig');
  RuntimeConfig.init().catch(console.error);
} catch (err: any) {
  console.error('❌ Fatal startup error:', err);
  initError = err;
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (initError || !app) {
    return res.status(500).json({
      error: {
        message: 'Server failed to start',
        detail: initError?.message || 'Unknown startup error',
        code: 'STARTUP_FAILURE',
      },
    });
  }
  return app(req, res);
}
