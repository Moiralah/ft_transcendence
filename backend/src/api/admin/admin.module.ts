import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminsService } from './admins.service';
import { PrismaService } from '../../prisma/prisma.service';
import { TreeModule } from '../tree/tree.module';
import { MailModule } from '../../mail/mail.module';

@Module({
	imports: [TreeModule, MailModule],
	controllers: [AdminController],
	providers: [AdminService, AdminsService, PrismaService],
})
export class AdminModule { }
