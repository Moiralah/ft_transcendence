import { IsIn } from 'class-validator';

// HOLDER (a made-up profile) is never assigned by hand.
export class UpdateMemberRoleDto {
	@IsIn(['ADMIN', 'MODERATOR', 'MEMBER', 'JOINER'])
	role: 'ADMIN' | 'MODERATOR' | 'MEMBER' | 'JOINER';
}
