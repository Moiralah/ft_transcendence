import { randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import {
	Injectable, Logger, HttpException, HttpStatus,
	BadRequestException, UnauthorizedException, ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuthService } from '../auth.service';

const RECOVERY_CODE_COUNT = 8;

// A 6-digit TOTP only has 1,000,000 values, so unlimited guesses during the
// challenge token's 5-minute life would be brute-forceable. After this many
// wrong codes the account's 2FA login is refused for LOCKOUT_MS.
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 3 * 60 * 1000;

@Injectable()
export class TwoFactorService {
	private readonly logger = new Logger(TwoFactorService.name);
	// Keyed by user id, not challenge token: an attacker who has the password
	// can just log in again for a fresh challenge token. In-memory, so it resets
	// on backend restart and isn't shared between instances — fine for one
	// container here; a multi-instance deployment would need Redis or the DB.
	private readonly failedAttempts = new Map<string, { count: number; last: number; lockedUntil: number }>();

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

		// Checked before the code, and even a correct code is refused while
		// locked — otherwise the guessing could just continue until it hits.
		this.assertNotLocked(payload.sub);

		const user = await this.prisma.user.findUniqueOrThrow({ where: { id: payload.sub } });
		if (!user.twoFactorEnabled || !user.twoFactorSecret) {
			throw new ForbiddenException('2FA is not enabled for this account.');
		}

		if (authenticator.verify({ token: code, secret: user.twoFactorSecret })) {
			this.failedAttempts.delete(user.id);
			return this.auth.issueSession(user);
		}

		if (await this.tryConsumeRecoveryCode(user.id, code)) {
			this.failedAttempts.delete(user.id);
			return this.auth.issueSession(user);
		}

		this.recordFailure(user.id);
		throw new UnauthorizedException('Invalid 2FA code.');
	}

	private assertNotLocked(userId: string) {
		const entry = this.failedAttempts.get(userId);
		if (entry && entry.lockedUntil > Date.now()) {
			const minutes = Math.ceil((entry.lockedUntil - Date.now()) / 60000);
			throw new HttpException(
				`Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
				HttpStatus.TOO_MANY_REQUESTS,
			);
		}
	}

	// Logs the user id and counts only — never the submitted code.
	private recordFailure(userId: string) {
		const now = Date.now();
		let entry = this.failedAttempts.get(userId);
		// Old failures (or a finished lockout) don't count against a fresh try.
		if (!entry || now - entry.last > LOCKOUT_MS) {
			entry = { count: 0, last: now, lockedUntil: 0 };
		}
		entry.count++;
		entry.last = now;
		if (entry.count >= MAX_FAILED_ATTEMPTS) {
			entry.lockedUntil = now + LOCKOUT_MS;
			entry.count = 0;
			this.logger.warn(`2FA login locked for user ${userId}: ${MAX_FAILED_ATTEMPTS} failed attempts, ${LOCKOUT_MS / 60000} min lockout`);
		} else {
			this.logger.warn(`2FA login failed for user ${userId} (${entry.count}/${MAX_FAILED_ATTEMPTS})`);
		}
		this.failedAttempts.set(userId, entry);
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
