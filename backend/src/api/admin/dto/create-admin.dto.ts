import { IsEmail, IsString, MinLength } from 'class-validator';

export class CreateAdminDto {
	@IsEmail()
	email: string;

	// A first password the new admin changes in Settings after signing in.
	@IsString()
	@MinLength(8) // matches minimum_password_length in supabase/config.toml
	password: string;
}
