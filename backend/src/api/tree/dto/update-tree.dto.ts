import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateTreeDto {
	@IsOptional()
	@IsString()
	@IsNotEmpty()
	@MaxLength(200)
	name?: string;

	@IsOptional()
	@IsString()
	@MaxLength(2000)
	description?: string;

	@IsOptional()
	@IsBoolean()
	isPublic?: boolean;
}
