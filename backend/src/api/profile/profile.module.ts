import { Module } from '@nestjs/common';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { PrismaService } from '../../prisma/prisma.service';
import { TreeModule } from '../tree/tree.module';

@Module({
	imports: [TreeModule], // TreeService: live tree updates after a profile save
	controllers: [ProfileController],
	providers: [ProfileService, PrismaService],
})
export class ProfileModule { }
