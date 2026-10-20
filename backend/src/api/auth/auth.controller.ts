
import { Controller, Post, Get, Delete, Body, Req, HttpCode, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { NotGuestGuard } from './not-guest.guard';
import { ChangeEmailDto, ChangePasswordDto, DeleteAccountDto, LoginDto } from './dto/auth.dto';

@Controller(`auth`) // Base route path prefix: /auth
export class AuthController {
	constructor(private readonly auth: AuthService) { }

	@Post('login') // Handles POST /auth/login
	async login(@Body() body: LoginDto) {
		return this.auth.loginWithSupabaseToken(body.accessToken, body.portal);
	}

	// Ends the session the request was made with (the frontend's Logout button).
	@Post('logout')
	@UseGuards(JwtAuthGuard)
	@HttpCode(204)
	async logout(@Req() req) {
		await this.auth.logout(req.user.jti, req.user.exp);
	}

	// "Try as guest" on the front page: a session on the shared guest account,
	// no Supabase login needed. Its demo tree is (re)created if it's missing.
	@Post('guest')
	@HttpCode(200)
	async guest() {
		return this.auth.loginAsGuest();
	}

	// Email, pending email change and whether there's a password at all, for
	// the settings forms (the browser keeps no Supabase session to ask itself).
	@Get('account')
	@UseGuards(JwtAuthGuard, NotGuestGuard) // a guest has no Supabase login to describe
	async account(@Req() req) {
		return this.auth.getAccount(req.user.id);
	}

	@Post('change-email')
	@UseGuards(JwtAuthGuard, NotGuestGuard)
	@HttpCode(200)
	async changeEmail(@Req() req, @Body() body: ChangeEmailDto) {
		return this.auth.changeEmail(req.user.id, body?.currentPassword, body?.newEmail);
	}

	@Post('change-password')
	@UseGuards(JwtAuthGuard, NotGuestGuard)
	@HttpCode(200)
	async changePassword(@Req() req, @Body() body: ChangePasswordDto) {
		return this.auth.changePassword(req.user.id, body?.currentPassword, body?.newPassword);
	}

	// The user deleting their own account (admins delete others via /users/:id).
	@Delete('account')
	@UseGuards(JwtAuthGuard, NotGuestGuard)
	async deleteAccount(@Req() req, @Body() body: DeleteAccountDto) {
		return this.auth.deleteOwnAccount(req.user.id, body?.currentPassword, body?.confirm);
	}
}
