import {
	IsInt, IsNotEmpty, IsOptional, IsString, MaxLength
} from 'class-validator';

export class CreatePublicTreeDto {
	@IsString()
	@IsNotEmpty()
	@MaxLength(100)
	name!: string;

	@IsOptional()
	@IsString()
	@MaxLength(1000)
	description?: string;

	@IsInt()
	ownerProfileId!: number;
}