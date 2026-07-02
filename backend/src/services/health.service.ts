import prisma from '../prisma/client';

export class HealthService {
  public static async getHealthStatus() {
    let dbStatus = 'UNKNOWN';
    let dbError = null;

    try {
      // Quick query to test DB connectivity with timeout check
      await Promise.race([
        prisma.$queryRaw`SELECT 1`,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Database timeout')), 2000))
      ]);
      dbStatus = 'CONNECTED';
    } catch (error: any) {
      dbStatus = 'DISCONNECTED';
      dbError = error.message || 'Failed to connect to PostgreSQL';
    }

    return {
      status: dbStatus === 'CONNECTED' ? 'OK' : 'DEGRADED',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        database: {
          status: dbStatus,
          ...(dbError && { error: dbError }),
        },
        api: {
          status: 'OK',
        },
      },
    };
  }
}
