
import { Controller, Post, Get, Body, Req, HttpCode, UseGuards, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller(`auth`) // Base route path prefix: /auth
export class AuthController {
	constructor(private readonly auth: AuthService) { }

	@Post('login') // Handles POST /auth/login
	async login(@Body('accessToken') accessToken: string) {
		if (!accessToken) {
			throw new BadRequestException('Missing access token');
		}
		return this.auth.loginWithSupabaseToken(accessToken);
	}

	// Email, pending email change and whether there's a password at all, for
	// the settings forms (the browser keeps no Supabase session to ask itself).
	@Get('account')
	@UseGuards(JwtAuthGuard)
	async account(@Req() req) {
		return this.auth.getAccount(req.user.id);
	}

	@Post('change-email')
	@UseGuards(JwtAuthGuard)
	@HttpCode(200)
	async changeEmail(@Req() req, @Body() body: { currentPassword: string; newEmail: string }) {
		return this.auth.changeEmail(req.user.id, body?.currentPassword, body?.newEmail);
	}

	@Post('change-password')
	@UseGuards(JwtAuthGuard)
	@HttpCode(200)
	async changePassword(@Req() req, @Body() body: { currentPassword: string; newPassword: string }) {
		return this.auth.changePassword(req.user.id, body?.currentPassword, body?.newPassword);
	}
}
