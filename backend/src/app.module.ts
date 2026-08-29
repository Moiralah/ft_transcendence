import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseModule } from './supabase/supabase.module';
import { AuthModule } from './api/auth/auth.module';
import { ProfileModule } from './api/profile/profile.module';
import { PrismaModule } from './prisma/prisma.module';
import { PrismaService } from './prisma/prisma.service';
import { TreeModule } from './api/tree/tree.module';

@Module({
	imports: [
		ConfigModule.forRoot({
			isGlobal: true ,
			envFilePath: '../.env',
		}),
		SupabaseModule,
		PrismaModule,
		AuthModule,
		ProfileModule,
		TreeModule,
	],
	providers:[PrismaService],
})
export class AppModule { }
