import { Controller, Get, Res, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HealthService } from './health.service';

@ApiTags('Health & Observability')
@Controller('api')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('health')
  @ApiOperation({ summary: 'System health check for Postfix, Dovecot, PostgreSQL, and Redis' })
  @ApiResponse({ status: 200, description: 'All core services healthy' })
  @ApiResponse({ status: 503, description: 'One or more core services down or degraded' })
  async getHealth(@Res() res: Response) {
    const result = await this.healthService.checkHealth();
    const statusCode = result.status === 'healthy' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;
    return res.status(statusCode).json(result);
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Prometheus metrics endpoint' })
  @ApiResponse({ status: 200, description: 'Prometheus metrics text' })
  async getMetrics(@Res() res: Response) {
    const metrics = await this.healthService.getMetrics();
    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    return res.send(metrics);
  }
}
