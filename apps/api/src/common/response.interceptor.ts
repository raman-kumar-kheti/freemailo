import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { map } from 'rxjs/operators';

export function publicResponse(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date || Buffer.isBuffer(value)) return value;
  if (Array.isArray(value)) return value.map(publicResponse);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !['passwordHash', 'dkimPrivateKey'].includes(key))
    .map(([key, item]) => [key, publicResponse(item)]));
  return value;
}

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler) {
    return next.handle().pipe(map(publicResponse));
  }
}
