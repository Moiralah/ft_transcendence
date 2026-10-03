import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { PrismaService } from '../../prisma/prisma.service';
import { TwoFactorController } from './two-factor/two-factor.controller';
import { TwoFactorService } from './two-factor/two-factor.service';

@Module({
	imports: [
		PassportModule,
		ConfigModule,
		JwtModule.registerAsync({
			inject: [ConfigService],
			useFactory: (config: ConfigService) => ({
				secret: config.get<string>('JWT_SECRET'),
				signOptions: { expiresIn: `${config.get<string>('JWT_EXPIRES_IN')}s` },
			}),
		}),
	],
	controllers: [AuthController, TwoFactorController],
	providers: [AuthService, JwtStrategy, PrismaService, TwoFactorService],
	exports: [AuthService],
})
export class AuthModule { }
