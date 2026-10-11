import { Module } from '@nestjs/common';
import { MailService } from './mail.service';

// Import this module wherever email is sent; see MailService.
@Module({
	providers: [MailService],
	exports: [MailService],
})
export class MailModule { }
