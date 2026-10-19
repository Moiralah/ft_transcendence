import { IsIn } from 'class-validator';

export class UpdateRoleDto {
	// Not ADMIN: site admins are separate accounts (Admin table, /admin/admins).
	@IsIn(['MODERATOR', 'USER'])
	role: 'MODERATOR' | 'USER';
}
