import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateTreeDto {
	@IsString()
	@IsNotEmpty()
	@MaxLength(200)
	name: string;

	@IsOptional()
	@IsString()
	@MaxLength(2000)
	description?: string;
}
