import { randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import {
	Injectable, BadRequestException, UnauthorizedException, ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuthService } from '../auth.service';

const RECOVERY_CODE_COUNT = 8;

@Injectable()
export class TwoFactorService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly jwt: JwtService,
		private readonly auth: AuthService,
	) { }

	async getStatus(userId: string) {
		const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
		return { enabled: user.twoFactorEnabled };
	}

	async setup(userId: string, email: string) {
		const secret = authenticator.generateSecret();
		await this.prisma.user.update({ where: { id: userId }, data: { twoFactorSecret: secret } });

		const otpauthUrl = authenticator.keyuri(email, 'Family Tree', secret);
		const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

		return { secret, otpauthUrl, qrCodeDataUrl };
	}

	async enable(userId: string, token: string) {
		const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
		if (!user.twoFactorSecret) {
			throw new BadRequestException('Call /auth/2fa/setup first.');
		}
		if (!authenticator.verify({ token, secret: user.twoFactorSecret })) {
			throw new UnauthorizedException('Invalid verification code.');
		}

		const recoveryCodes = this.generateRecoveryCodes();
		const hashedCodes = await Promise.all(
			recoveryCodes.map((code) => bcrypt.hash(code, 10)),
		);

		await this.prisma.$transaction(async (tx) => {
			await tx.user.update({ where: { id: userId }, data: { twoFactorEnabled: true } });
			await tx.recoveryCode.deleteMany({ where: { userId } });
			await tx.recoveryCode.createMany({
				data: hashedCodes.map((codeHash) => ({ userId, codeHash })),
			});
		});

		return { recoveryCodes };
	}

	async disable(userId: string, token: string) {
		const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
		if (!user.twoFactorEnabled || !user.twoFactorSecret) {
			throw new BadRequestException('2FA is not enabled.');
		}
		if (!authenticator.verify({ token, secret: user.twoFactorSecret })) {
			throw new UnauthorizedException('Invalid verification code.');
		}

		await this.prisma.$transaction(async (tx) => {
			await tx.user.update({
				where: { id: userId },
				data: { twoFactorEnabled: false, twoFactorSecret: null },
			});
			await tx.recoveryCode.deleteMany({ where: { userId } });
		});

		return { message: '2FA disabled.' };
	}

	async verifyLogin(challengeToken: string, code: string) {
		let payload: any;
		try {
			payload = await this.jwt.verifyAsync(challengeToken);
		} catch {
			throw new UnauthorizedException('Invalid or expired challenge token.');
		}
		if (payload.purpose !== 'mfa') {
			throw new UnauthorizedException('Invalid challenge token.');
		}

		const user = await this.prisma.user.findUniqueOrThrow({ where: { id: payload.sub } });
		if (!user.twoFactorEnabled || !user.twoFactorSecret) {
			throw new ForbiddenException('2FA is not enabled for this account.');
		}

		if (authenticator.verify({ token: code, secret: user.twoFactorSecret })) {
			return this.auth.issueSession(user);
		}

		if (await this.tryConsumeRecoveryCode(user.id, code)) {
			return this.auth.issueSession(user);
		}

		throw new UnauthorizedException('Invalid 2FA code.');
	}

	private async tryConsumeRecoveryCode(userId: string, code: string): Promise<boolean> {
		const unused = await this.prisma.recoveryCode.findMany({ where: { userId, usedAt: null } });
		for (const recoveryCode of unused) {
			if (await bcrypt.compare(code, recoveryCode.codeHash)) {
				await this.prisma.recoveryCode.update({
					where: { id: recoveryCode.id },
					data: { usedAt: new Date() },
				});
				return true;
			}
		}
		return false;
	}

	private generateRecoveryCodes(): string[] {
		return Array.from({ length: RECOVERY_CODE_COUNT }, () => {
			const raw = randomBytes(5).toString('hex').toUpperCase();
			return `${raw.slice(0, 5)}-${raw.slice(5, 10)}`;
		});
	}
}
