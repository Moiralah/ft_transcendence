import { Controller, Body, Delete, Get, Param,
			Patch, Post, UseGuards } from '@nestjs/common';
import { PersonsService } from './persons.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('persons')
export class PersonsController {
	constructor(private readonly persons: PersonsService) { }

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

	@Patch(':id')
	@UseGuards(JwtAuthGuard)
	update(@Param('id') id: string, @Body() body: any) {
		return this.persons.update(Number(id), body);
	}

	@Delete(':id')
	@UseGuards(JwtAuthGuard)
	remove(@Param('id') id: string) {
		return this.persons.remove(Number(id));
	}
}
