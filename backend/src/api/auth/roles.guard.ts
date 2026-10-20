import { Injectable, CanActivate, ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';
import { MFA_SESSION_REQUIRED, MODERATOR_MFA_REQUIRED } from './jwt.strategy';

@Injectable()
export class RolesGuard implements CanActivate {
	constructor(private readonly reflector: Reflector) { }

	canActivate(context: ExecutionContext): boolean {
		const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
			context.getHandler(),
			context.getClass(),
		]);
		if (!requiredRoles || requiredRoles.length === 0) return true;

		const { user } = context.switchToHttp().getRequest();
		if (!user || !requiredRoles.includes(user.role)) {
			throw new ForbiddenException('Insufficient permissions.');
		}
		// Moderation needs MFA (admins are held to it in JwtStrategy already).
		if (user.role === 'MODERATOR' && !user.mfa) {
			throw new ForbiddenException(MODERATOR_MFA_REQUIRED);
		}
		// MFA on, but this session is from before it was (never passed it).
		if (user.role === 'MODERATOR' && !user.mfaSession) {
			throw new UnauthorizedException(MFA_SESSION_REQUIRED);
		}
		return true;
	}
}
