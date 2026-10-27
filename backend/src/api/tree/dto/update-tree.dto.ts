import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { IsClean, IsCleanName } from '../../clean-text';

export class UpdateTreeDto {
	@IsOptional()
	@IsString()
	@IsNotEmpty()
	@MaxLength(200)
	@IsCleanName()
	name?: string;

	@IsOptional()
	@IsString()
	@MaxLength(2000)
	@IsClean()
	description?: string;

	@IsOptional()
	@IsBoolean()
	isPublic?: boolean;
}
