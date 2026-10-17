import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

// Site admins (role ADMIN, "Sign in as staff") are not family-tree users: they
// run the admin console (/admin) and manage every user and tree from there.
// The member features (making or joining trees, claiming a person, friends)
// are refused. Use after JwtAuthGuard, which loads the role from the database
// on every request.
@Injectable()
export class NotSiteAdminGuard implements CanActivate {
	canActivate(context: ExecutionContext): boolean {
		const { user } = context.switchToHttp().getRequest();
		if (user?.role === 'ADMIN') {
			throw new ForbiddenException('Site admin accounts don\'t make trees or friends. Use the admin console.');
		}
		return true;
	}
}
