// backend/src/api/profile/profile.controller.ts
import { Controller, Body, Delete, Get, Param, Req,
			Patch, Post, UseGuards } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Profile } from '../../generated/browser';

// Define the request structure populated by JwtAuthGuard
interface AuthenticatedRequest {
  user: {
    id: string; // The user ID extracted from JWT token payload
    username?: string;
  };
}

@Controller(`profile`)
export class ProfileController {
	constructor(private readonly profileService: ProfileService) { }

	@Get('me')
	@UseGuards(JwtAuthGuard)
	findMe(@Req() req: AuthenticatedRequest) {
	    return this.profileService.findMe(req.user.id);
  	}
	}

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
