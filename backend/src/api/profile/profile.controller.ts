import {
	Controller, Body, Delete, Get, Param, Query, Req,
	Patch, Post, UseGuards, BadRequestException
} from '@nestjs/common';
import { ProfileService } from './profile.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Profile } from '../../generated/browser';


interface AuthenticatedRequest {
	user: {
		id: string; // The user ID extracted from JWT token payload
		username?: string;
		profileId?: number | null;
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
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles('ADMIN') // not used by the app; site admins only
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
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles('ADMIN') // not used by the app; site admins only
	findOne(@Param('id') id: string) {
		return this.profile.findOne(id);
	}

	@Post()
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles('ADMIN') // not used by the app; site admins only
	create(@Body() body: any) {
		return this.profile.create(body);
	}

	// Your own profile, or a profile in a tree where you may edit it (the same
	// rule the canvas shows in the UI): 403 otherwise, 404 if it doesn't exist.
	@Patch(':id')
	@UseGuards(JwtAuthGuard)
	async update(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() body: any) {
		const profileId = Number(id);
		if (!Number.isInteger(profileId) || profileId <= 0) {
			throw new BadRequestException('Invalid profile id.');
		}
		await this.profile.assertCanEdit(req.user.id, req.user.profileId ?? null, profileId);
		return this.profile.update(profileId, body);
	}

	@Delete(':id')
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles('ADMIN') // not used by the app; site admins only
	remove(@Param('id') id: string) {
		return this.profile.remove(Number(id));
	}

	@Get('tree/:rootId')
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles('ADMIN') // not used by the app; site admins only
	async getTree(@Param('rootId') rootId: string) {
		return this.profile.getTree(Number(rootId));
	}
}
