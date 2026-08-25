
import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller(`auth`) // Base route path prefix: /auth
export class AuthController {
	constructor(private readonly auth: AuthService) { }

	@Post('login') // Handles POST /auth/login
	async login(@Body('accessToken') accessToken: string) {
		if (!accessToken) {
			throw new Error('Missing access token');
		}
		return this.auth.loginWithSupabaseToken(accessToken);
	}
}
