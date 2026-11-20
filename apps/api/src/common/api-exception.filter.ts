import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { Response } from 'express';
import { randomUUID } from 'crypto';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);
  catch(error: any, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    if (error instanceof HttpException) return res.status(error.getStatus()).json(error.getResponse());
    const id = randomUUID();
    const code = typeof error?.code === 'string' ? error.code : 'UNKNOWN';
    const unavailable = /ECONN|ETIMEDOUT|ENOTFOUND|Connection|NoConnection|Unavailable|Socket|CommandFailed|SERVERBUG/i.test(code) || error?.responseStatus === 'NO';
    const conflict = code === 'P2002';
    const missing = code === 'P2025';
    const status = conflict ? 409 : missing ? 404 : unavailable ? 503 : 500;
    // Correlation without credentials, raw protocol responses, or message bodies.
    this.logger.error(JSON.stringify({ requestId: id, code, status, type: error?.name || 'Error' }));
    res.status(status).json({ statusCode: status, message: conflict ? 'This resource already exists' : missing ? 'Resource not found' : unavailable ? 'Mail service is temporarily unavailable. Please retry.' : 'Request failed. Please retry or contact the administrator.', requestId: id });
  }
}
