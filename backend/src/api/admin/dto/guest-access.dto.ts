import { IsBoolean } from 'class-validator';

export class GuestAccessDto {
	@IsBoolean()
	guestAccess: boolean;
}
