import { IsIn } from 'class-validator';

export class UpdateRoleDto {
	@IsIn(['ADMIN', 'MODERATOR', 'USER'])
	role: 'ADMIN' | 'MODERATOR' | 'USER';
}
