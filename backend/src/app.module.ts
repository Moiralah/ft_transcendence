import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseModule } from './supabase/supabase.module';
import { AuthModule } from './api/auth/auth.module';
import { PersonsModule } from './api/persons/persons.module';
import { PrismaModule } from './prisma/prisma.module';
import { PrismaService } from './prisma/prisma.service';

@Module({
	imports: [
		ConfigModule.forRoot({
			isGlobal: true ,
			envFilePath: '../.env',
		}),
		SupabaseModule,
		PrismaModule,
		AuthModule,
		PersonsModule,
	],
	providers:[PrismaService],
})
export class AppModule { }
