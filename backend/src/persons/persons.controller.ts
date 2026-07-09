import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { PersonsService } from './persons.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('persons')
export class PersonsController {
  constructor(private readonly persons: PersonsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll() {
    return this.persons.findAll();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id') id: string) {
    return this.persons.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() body: any) {
    return this.persons.create(body);
  }
}
