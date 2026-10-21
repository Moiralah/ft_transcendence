import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class LoginDto {
	@IsString({ message: 'Missing access token' })
	@IsNotEmpty({ message: 'Missing access token' })
	@MaxLength(8192)
	accessToken: string;

	// 'staff' = the "Sign in as staff" page (admins only); left out = the
	// normal login (users and moderators).
	@IsOptional()
	@IsIn(['staff'], { message: 'Unknown sign-in page' })
	portal?: 'staff';
}

// The reset-password page's Supabase session, after it set the new password.
export class PasswordResetDto {
	@IsString({ message: 'Missing access token' })
	@IsNotEmpty({ message: 'Missing access token' })
	@MaxLength(8192)
	accessToken: string;
}

// The service gives the friendly messages (wrong password, invalid email, too
// short); these only make sure each field is text of a sane length.
export class ChangeEmailDto {
	@IsOptional()
	@IsString()
	@MaxLength(200)
	currentPassword?: string;

	@IsString()
	@MaxLength(320)
	newEmail: string;
}

export class ChangePasswordDto {
	@IsOptional()
	@IsString()
	@MaxLength(200)
	currentPassword?: string;

	@IsString()
	@MaxLength(200)
	newPassword: string;
}

export class DeleteAccountDto {
	@IsOptional()
	@IsString()
	@MaxLength(200)
	currentPassword?: string;

	@IsOptional()
	@IsString()
	@MaxLength(20)
	confirm?: string;
}
