import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { PrismaService } from '../../prisma/prisma.service';
import { TreeModule } from '../tree/tree.module';

@Module({
	imports: [TreeModule],
	controllers: [AdminController],
	providers: [AdminService, PrismaService],
})
export class AdminModule { }
