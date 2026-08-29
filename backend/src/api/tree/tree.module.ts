import { Module } from '@nestjs/common';
import { TreeController } from './tree.controller';
import { TreeService } from './tree.service';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
  controllers: [TreeController],
  providers: [TreeService, PrismaService],
  exports: [TreeService],
})
export class TreeModule {}