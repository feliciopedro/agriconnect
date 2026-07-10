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

export default function handler(req: any, res: any) {
  if (initError || !app) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({
      error: {
        message: 'Server failed to start',
        detail: initError?.message || 'Unknown startup error',
        code: 'STARTUP_FAILURE',
      },
    }));
  }
  return app(req, res);
}
