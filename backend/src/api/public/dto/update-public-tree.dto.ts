import {
	IsNotEmpty,	IsOptional, IsString, MaxLength
} from 'class-validator';

export class UpdatePublicTreeDto {
	@IsOptional()
	@IsString()
	@IsNotEmpty()
	@MaxLength(100)
	name?: string;

	@IsOptional()
	@IsString()
	@MaxLength(1000)
	description?: string;
}