import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { TwoFactorService } from './two-factor.service';
import { JwtAuthGuard } from '../jwt-auth.guard';
import { TwoFactorCodeDto, TwoFactorLoginVerifyDto } from './dto/two-factor.dto';

interface AuthenticatedRequest {
	user: { id: string; email: string };
}

@Controller('auth/2fa')
export class TwoFactorController {
	constructor(private readonly twoFactor: TwoFactorService) { }

	@Get('status')
	@UseGuards(JwtAuthGuard)
	status(@Req() req: AuthenticatedRequest) {
		return this.twoFactor.getStatus(req.user.id);
	}

	@Post('setup')
	@UseGuards(JwtAuthGuard)
	setup(@Req() req: AuthenticatedRequest) {
		return this.twoFactor.setup(req.user.id, req.user.email);
	}

	@Post('enable')
	@UseGuards(JwtAuthGuard)
	enable(@Req() req: AuthenticatedRequest, @Body() body: TwoFactorCodeDto) {
		return this.twoFactor.enable(req.user.id, body.token);
	}

	@Post('disable')
	@UseGuards(JwtAuthGuard)
	disable(@Req() req: AuthenticatedRequest, @Body() body: TwoFactorCodeDto) {
		return this.twoFactor.disable(req.user.id, body.token);
	}

	// No JwtAuthGuard here — the caller only has a "purpose: mfa" challenge
	// token at this point, which JwtStrategy deliberately rejects everywhere
	// else. The challenge token itself is verified inside the service.
	@Post('login-verify')
	loginVerify(@Body() body: TwoFactorLoginVerifyDto) {
		return this.twoFactor.verifyLogin(body.challengeToken, body.code);
	}
}
