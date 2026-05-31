import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * `GET /api/health` — lightweight readiness probe. Returns 200 when the API
 * process is up AND the DB answers a trivial `SELECT 1`. Returns 503 if the
 * DB query fails — that's the signal a load balancer / Kubernetes uses to
 * yank the pod from the rotation.
 */
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    let database: 'up' | 'down' = 'down';
    try {
      await this.prisma.$queryRawUnsafe('SELECT 1');
      database = 'up';
    } catch {
      throw new ServiceUnavailableException({
        status: 'down',
        database: 'down',
      });
    }
    return {
      status: 'ok',
      database,
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }
}
