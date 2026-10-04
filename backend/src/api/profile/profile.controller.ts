import {
	Controller, Body, Delete, Get, Param, Query, Req,
	Patch, Post, UseGuards, BadRequestException
} from '@nestjs/common';
import { ProfileService } from './profile.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Profile } from '../../generated/browser';


interface AuthenticatedRequest {
	user: {
		id: string; // The user ID extracted from JWT token payload
		username?: string;
	};
}

@Controller(`profile`)
export class ProfileController {
	constructor(private readonly profile: ProfileService) { }

	@Get('me')
	@UseGuards(JwtAuthGuard)
	findMe(@Req() req: AuthenticatedRequest) {
		return this.profile.findMe(req.user.id);
	}

	@Get()
	@UseGuards(JwtAuthGuard)
	findAll() {
		return this.profile.findAll();
	}

	@Get('search')
	@UseGuards(JwtAuthGuard)
	search(
			@Req() req: AuthenticatedRequest,
			@Query('firstName') firstName?: string,
			@Query('lastName') lastName?: string,
			@Query('birthDate') birthDate?: string,
			@Query('gender') gender?: string,
			@Query('sortBy') sortBy?: 'firstName' | 'lastName',
			@Query('order') order?: 'asc' | 'desc',
			@Query('page') page?: string,
			@Query('limit') limit?: string,
	) {
			return this.profile.search(
					req.user.id,
					firstName,
					lastName,
					birthDate,
					gender,
					sortBy === 'lastName' ? 'lastName' : 'firstName',
					order === 'desc' ? 'desc' : 'asc',
					page ? Number(page) : 1,
					limit ? Number(limit) : 10,
			);
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
	async update(@Param('id') id: string, @Body() body: any) {
		return this.profile.update(Number(id), body);
	}

	@Delete(':id')
	@UseGuards(JwtAuthGuard)
	remove(@Param('id') id: string) {
		return this.profile.remove(Number(id));
	}

	@Get('tree/:rootId')
	@UseGuards(JwtAuthGuard)
	async getTree(@Param('rootId') rootId: string) {
		return this.profile.getTree(Number(rootId));
	}
}
