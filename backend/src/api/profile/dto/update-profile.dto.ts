import { IsDateString, IsInt, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

// The canvas sends the whole member row; fields not listed here are dropped by
// the global ValidationPipe (whitelist). Dates may be '' or null: "no change".
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
