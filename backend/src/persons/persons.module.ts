import { Module } from '@nestjs/common';
import { PersonsController } from './persons.controller';
import { PersonsService } from './persons.service';
import { PgService } from '../prisma/pg.service';

@Module({
  controllers: [PersonsController],
  providers: [PersonsService, PgService],
})
export class PersonsModule {}
