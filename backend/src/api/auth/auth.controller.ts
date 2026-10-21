
import { Controller, Post, Get, Delete, Body, Req, Res, HttpCode, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { NotGuestGuard } from './not-guest.guard';
import { ChangeEmailDto, ChangePasswordDto, DeleteAccountDto, LoginDto, PasswordResetDto } from './dto/auth.dto';
import { clearSessionCookie, withSessionCookie } from './session-cookie';

@Controller(`auth`) // Base route path prefix: /auth
export class AuthController {
	constructor(private readonly auth: AuthService) { }

	@Post('login') // Handles POST /auth/login
	async login(@Body() body: LoginDto, @Res({ passthrough: true }) res: Response) {
		// An MFA challenge has no session yet: nothing to set until login-verify.
		return withSessionCookie(res, await this.auth.loginWithSupabaseToken(body.accessToken, body.portal));
	}

	// Ends the session the request was made with (the frontend's Logout button).
	@Post('logout')
	@UseGuards(JwtAuthGuard)
	@HttpCode(204)
	async logout(@Req() req, @Res({ passthrough: true }) res: Response) {
		await this.auth.logout(req.user.jti, req.user.exp);
		clearSessionCookie(res);
	}

	// "Try as guest" on the front page: a session on the shared guest account,
	// no Supabase login needed. Its demo tree is (re)created if it's missing.
	@Post('guest')
	@HttpCode(200)
	async guest(@Res({ passthrough: true }) res: Response) {
		return withSessionCookie(res, await this.auth.loginAsGuest());
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

	// Ends every session of the account, this one included: sign in again.
	@Post('change-password')
	@UseGuards(JwtAuthGuard, NotGuestGuard)
	@HttpCode(200)
	async changePassword(@Req() req, @Body() body: ChangePasswordDto, @Res({ passthrough: true }) res: Response) {
		const result = await this.auth.changePassword(req.user.id, body?.currentPassword, body?.newPassword);
		clearSessionCookie(res);
		return result;
	}

	// After the reset-password page set a new password with Supabase: ends
	// every app session of the account, like Change password.
	@Post('password-reset')
	@HttpCode(204)
	async passwordReset(@Body() body: PasswordResetDto, @Res({ passthrough: true }) res: Response) {
		await this.auth.endSessionsAfterReset(body.accessToken);
		clearSessionCookie(res);
	}

	// The user deleting their own account (admins delete others via /users/:id).
	@Delete('account')
	@UseGuards(JwtAuthGuard, NotGuestGuard)
	async deleteAccount(@Req() req, @Body() body: DeleteAccountDto, @Res({ passthrough: true }) res: Response) {
		const result = await this.auth.deleteOwnAccount(req.user.id, body?.currentPassword, body?.confirm);
		clearSessionCookie(res);
		return result;
	}
}
