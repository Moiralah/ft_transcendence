import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

// Must be plain strings: an object such as { "not": "" } would reach Prisma's
// where clause as a filter and match a tree without its code.
export class JoinTreeDto {
	@IsString()
	@IsNotEmpty()
	@MaxLength(200)
	name: string;

	@IsString()
	@IsNotEmpty()
	@MaxLength(64)
	code: string;
}
