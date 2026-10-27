import { IsDateString, IsInt, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';
import { IsClean, IsCleanName } from '../../clean-text';
import { IsProfileDate } from './date-range';

// The global ValidationPipe strips any field not listed here (whitelist),
// so extra fields are dropped, not rejected. The date may be '' or null:
// "no change".
const hasValue = (_: unknown, value: unknown) => value !== undefined && value !== null && value !== '';

export class UpdateProfileDto {
	@IsOptional()
	@IsString()
	@MaxLength(100)
	@IsCleanName()
	firstName?: string;

	@IsOptional()
	@IsString()
	@MaxLength(100)
	@IsCleanName()
	lastName?: string | null;

	@IsOptional()
	@IsString()
	@MaxLength(20)
	gender?: string | null;

	@ValidateIf(hasValue)
	@IsDateString()
	@IsProfileDate()
	birthDate?: string | null;

	@IsOptional()
	@IsInt()
	motherId?: number | null;

	@IsOptional()
	@IsInt()
	fatherId?: number | null;

	@IsOptional()
	@IsString()
	@MaxLength(250)
	@IsClean()
	bio?: string | null;
}
