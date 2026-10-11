import { ArrayMaxSize, IsArray, IsUUID } from 'class-validator';

export class FriendStatusDto {
	@IsArray()
	@ArrayMaxSize(500)
	@IsUUID('all', { each: true })
	userIds: string[];
}
