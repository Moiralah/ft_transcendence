import { Controller, Body, Delete, Get, Param,
			Patch, Post, UseGuards } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Profile } from '../../generated/browser';

@Controller(`profile`)
export class ProfileController {
	constructor(private readonly profile: ProfileService) { }

	@Get()
	@UseGuards(JwtAuthGuard)
	findAll() {
		return this.profile.findAll();
	}

	@Get(':id')
	@UseGuards(JwtAuthGuard)
	findOne(@Param('id') id: string) {
		return this.profile.findOne(id);
	}

	@Post()
	@UseGuards(JwtAuthGuard)
	create(@Body() body: any) {
		return this.profile.create(body);
	}

	@Patch(':id')
	@UseGuards(JwtAuthGuard)
	update(@Param('id') id: string, @Body() body: any) {
		return this.profile.update(Number(id), body);
	}

	@Delete(':id')
	@UseGuards(JwtAuthGuard)
	remove(@Param('id') id: string) {
		return this.profile.remove(Number(id));
	}
}
