import { IsOptional, IsString, MaxLength } from 'class-validator';

// Every field optional: the service gives the friendly messages (too short,
// bad email) and the honeypot must still look like a success to bots.
export class FeedbackDto {
	@IsOptional() @IsString() @MaxLength(20) category?: string;
	@IsOptional() @IsString() @MaxLength(10000) message?: string;
	@IsOptional() @IsString() @MaxLength(500) name?: string;
	@IsOptional() @IsString() @MaxLength(500) email?: string;
	@IsOptional() @IsString() @MaxLength(1000) page?: string;
	@IsOptional() @IsString() @MaxLength(500) website?: string;
}
