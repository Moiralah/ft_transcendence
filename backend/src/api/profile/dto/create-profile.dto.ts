import { IsDateString, IsInt, IsNumberString, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';
import { IsProfileDate } from './date-range';

const hasValue = (_: unknown, value: unknown) => value !== undefined && value !== null && value !== '';

// Admin-only endpoint, not used by the app. Field names as the service expects them.
export class CreateProfileDto {
	@IsString()
	@MaxLength(200)
	name: string;

	@IsOptional()
	@IsString()
	@MaxLength(20)
	gender?: string;

	@ValidateIf(hasValue)
	@IsNumberString()
	mother_id?: string;

	@ValidateIf(hasValue)
	@IsNumberString()
	father_id?: string;

	@ValidateIf(hasValue)
	@IsDateString()
	@IsProfileDate()
	birth_date?: string;

	@IsOptional()
	@IsInt()
	tree_id?: number;
}
