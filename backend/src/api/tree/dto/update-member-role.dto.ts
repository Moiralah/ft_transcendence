import { IsIn } from 'class-validator';

// HOLDER (a made-up profile) is never assigned by hand.
export class UpdateMemberRoleDto {
	@IsIn(['ADMIN', 'MEMBER', 'JOINER'])
	role: 'ADMIN' | 'MEMBER' | 'JOINER';
}
