import { Request, Response, NextFunction } from 'express';
import prisma from '../../prisma/client';
import { SmsOutboundService } from '../../services/ussd/smsOutbound.service';

export class SuperAdminUssdController {
  /**
   * GET /api/superadmin/ussd/sessions
   * Filterable by phone, menu, isActive, date range
   */
  public static async getSessions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { phone, menu, isActive, startDate, endDate } = req.query;
      const where: any = {};

      if (phone) {
        where.phone = { contains: String(phone) };
      }
      if (menu) {
        where.currentMenu = String(menu);
      }
      if (isActive !== undefined) {
        where.isActive = isActive === 'true';
      }
      if (startDate || endDate) {
        where.startedAt = {};
        if (startDate) {
          where.startedAt.gte = new Date(String(startDate));
        }
        if (endDate) {
          where.startedAt.lte = new Date(String(endDate));
        }
      }

      const sessions = await prisma.ussdSession.findMany({
        where,
        orderBy: { lastActivityAt: 'desc' },
        include: { user: true }
      });

      res.status(200).json(sessions);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/superadmin/ussd/sessions/:sessionId
   * Full session detail including inputHistory and UssdAuditLog entries
   */
  public static async getSessionById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sessionId } = req.params;

      const session = await prisma.ussdSession.findFirst({
        where: { sessionId },
        include: { user: true }
      });

      if (!session) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      const auditLogs = await prisma.ussdAuditLog.findMany({
        where: { sessionId },
        orderBy: { timestamp: 'asc' }
      });

      res.status(200).json({
        ...session,
        auditLogs
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/superadmin/ussd/audit
   * Filterable by phone, action, date range
   */
  public static async getAuditLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { phone, action, startDate, endDate } = req.query;
      const where: any = {};

      if (phone) {
        where.phone = { contains: String(phone) };
      }
      if (action) {
        where.menu = String(action);
      }
      if (startDate || endDate) {
        where.timestamp = {};
        if (startDate) {
          where.timestamp.gte = new Date(String(startDate));
        }
        if (endDate) {
          where.timestamp.lte = new Date(String(endDate));
        }
      }

      const logs = await prisma.ussdAuditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' }
      });

      res.status(200).json(logs);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/superadmin/ussd/sms-queue
   * Filterable by status
   */
  public static async getSmsQueue(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status } = req.query;
      const where: any = {};

      if (status) {
        where.status = String(status);
      }

      const queue = await prisma.ussdShortMessage.findMany({
        where,
        orderBy: { createdAt: 'desc' }
      });

      res.status(200).json(queue);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/superadmin/ussd/sms-queue/retry
   * Triggers retry manually
   */
  public static async retrySmsQueue(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await SmsOutboundService.retryStaleSms();
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/superadmin/ussd/stats
   */
  public static async getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      // Active sessions count
      const activeSessions = await prisma.ussdSession.count({
        where: { isActive: true }
      });

      // Sessions today count
      const sessionsToday = await prisma.ussdSession.count({
        where: { startedAt: { gte: startOfDay } }
      });

      // Sessions by menu breakdown
      const menuGroups = await prisma.ussdSession.groupBy({
        by: ['currentMenu'],
        _count: { id: true }
      });
      const sessionsByMenu = menuGroups.reduce((acc: Record<string, number>, curr) => {
        acc[curr.currentMenu || 'INIT'] = curr._count.id;
        return acc;
      }, {});

      // Average session duration
      const finishedSessions = await prisma.ussdSession.findMany({
        where: {
          isActive: false,
          endedAt: { not: null }
        },
        select: { startedAt: true, endedAt: true },
        take: 1000
      });

      let totalDurMs = 0;
      finishedSessions.forEach((s) => {
        if (s.endedAt && s.startedAt) {
          totalDurMs += s.endedAt.getTime() - s.startedAt.getTime();
        }
      });
      const avgSessionDurationSeconds =
        finishedSessions.length > 0 ? totalDurMs / finishedSessions.length / 1000 : 0;

      // SMS counts today
      const smsQueuedToday = await prisma.ussdShortMessage.count({
        where: { status: 'QUEUED', createdAt: { gte: startOfDay } }
      });
      const smsSentToday = await prisma.ussdShortMessage.count({
        where: { status: 'SENT', createdAt: { gte: startOfDay } }
      });
      const smsFailedToday = await prisma.ussdShortMessage.count({
        where: { status: 'FAILED', createdAt: { gte: startOfDay } }
      });

      // Language breakdown of all users
      const users = await prisma.user.findMany({
        select: { preferredLanguage: true }
      });
      const languageBreakdown: Record<string, number> = { en: 0, tw: 0, ew: 0, ha: 0 };
      users.forEach((u) => {
        const lang = u.preferredLanguage || 'en';
        if (lang in languageBreakdown) {
          languageBreakdown[lang]++;
        } else {
          languageBreakdown[lang] = 1;
        }
      });

      // Top menu paths (grouped by menu and step in UssdAuditLog)
      const pathLogs = await prisma.ussdAuditLog.groupBy({
        by: ['menu', 'step'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10
      });
      const topMenuPaths = pathLogs.map((l) => ({
        path: `${l.menu || 'INIT'} > ${l.step || 'START'}`,
        count: l._count.id
      }));

      res.status(200).json({
        activeSessions,
        sessionsToday,
        sessionsByMenu,
        avgSessionDurationSeconds,
        smsQueuedToday,
        smsSentToday,
        smsFailedToday,
        languageBreakdown,
        topMenuPaths
      });
    } catch (err) {
      next(err);
    }
  }
}
