import {
    CanActivate, ExecutionContext, Injectable, UnauthorizedException
} from '@nestjs/common';
import { timingSafeEqual } from 'crypto';

@Injectable()
export class PublicApiKeyGuard implements CanActivate {
        canActivate(context: ExecutionContext): boolean {
                const request = context.switchToHttp().getRequest();
                const providedKey = request.headers['x-api-key'];
                const expectedKey = process.env.PUBLIC_API_KEY;

                if (typeof providedKey !== 'string' || !expectedKey) {
                        throw new UnauthorizedException('Invalid API key');
                }

                const providedBuffer = Buffer.from(providedKey);
                const expectedBuffer = Buffer.from(expectedKey);

                if (providedBuffer.length !== expectedBuffer.length ||
                    !timingSafeEqual(providedBuffer, expectedBuffer)) {
                        throw new UnauthorizedException('Invalid API key');
                }

                return true;
        }
}
