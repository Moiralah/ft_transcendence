import { IsString, Length } from 'class-validator';

export class TwoFactorCodeDto {
	@IsString()
	@Length(6, 6)
	token: string;
}

export class TwoFactorLoginVerifyDto {
	@IsString()
	challengeToken: string;

	@IsString()
	@Length(6, 11) // 6-digit TOTP code, or an "XXXXX-XXXXX" recovery code
	code: string;
}
