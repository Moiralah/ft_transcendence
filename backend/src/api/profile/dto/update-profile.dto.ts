import { IsDateString, IsInt, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

// The global ValidationPipe rejects any field not listed here
// (forbidNonWhitelisted), so the profile forms send only these. Dates may be
// '' or null: "no change".
const hasValue = (_: unknown, value: unknown) => value !== undefined && value !== null && value !== '';

export class UpdateProfileDto {
	@IsOptional()
	@IsString()
	@MaxLength(100)
	firstName?: string;

	@IsOptional()
	@IsString()
	@MaxLength(100)
	lastName?: string | null;

	@IsOptional()
	@IsString()
	@MaxLength(20)
	gender?: string | null;

	@ValidateIf(hasValue)
	@IsDateString()
	birthDate?: string | null;

	@ValidateIf(hasValue)
	@IsDateString()
	deathDate?: string | null;

	@IsOptional()
	@IsInt()
	motherId?: number | null;

	@IsOptional()
	@IsInt()
	fatherId?: number | null;

	@IsOptional()
	@IsString()
	@MaxLength(2000)
	bio?: string | null;
}
