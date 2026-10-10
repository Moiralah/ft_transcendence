import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { PrismaService } from '../../prisma/prisma.service';
import { MailModule } from '../../mail/mail.module';

@Module({
	imports: [MailModule],
	controllers: [UsersController],
	providers: [UsersService, PrismaService],
})
export class UsersModule { }
