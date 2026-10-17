import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

// The guest account (site role GUEST, "Try as guest" on the front page) is one
// login shared by every visitor. Anything that would lock the others out or
// reach real people (password, email, 2FA, deleting the account, friend
// requests, uploads, new, joined or deleted trees) is refused. Use after JwtAuthGuard, which loads the role
// from the database on every request.
@Injectable()
export class NotGuestGuard implements CanActivate {
	canActivate(context: ExecutionContext): boolean {
		const { user } = context.switchToHttp().getRequest();
		if (user?.role === 'GUEST') {
			throw new ForbiddenException('Not available on the guest account. Sign up for your own account to do this.');
		}
		return true;
	}
}
