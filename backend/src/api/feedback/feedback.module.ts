import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FeedbackController } from './feedback.controller';
import { FeedbackService } from './feedback.service';
import { MailModule } from '../../mail/mail.module';

@Module({
	imports: [ConfigModule, MailModule],
	controllers: [FeedbackController],
	providers: [FeedbackService],
})
export class FeedbackModule { }
