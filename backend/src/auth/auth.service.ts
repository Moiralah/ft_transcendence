// import { Inject, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
// import { JwtService } from '@nestjs/jwt';
// import { SupabaseClient } from '@supabase/supabase-js';
// import { SUPABASE_SDK_CLIENT } from '../supabase/supabase.constant';

// @Injectable()
// export class AuthService {
//   constructor(
//     @Inject(SUPABASE_SDK_CLIENT)
//     private readonly supabase: SupabaseClient | null,
//     private readonly jwt: JwtService,
//   ) {}

//   async login(email: string, password: string) {
//     if (!this.supabase) {
//       throw new ServiceUnavailableException('Supabase client is not configured');
//     }

//     const { data, error } = await this.supabase.auth.signInWithPassword({
//       email,
//       password,
//     });

//     if (error || !data.session?.access_token) {
//       throw new UnauthorizedException('Invalid credentials');
//     }

//     const user = await this.validateSessionToken(data.session.access_token);

//     const token = await this.jwt.signAsync({ sub: user.id, email: user.email });
//     return { access_token: token, user: { id: user.id, email: user.email } };
//   }

//   private async validateSessionToken(accessToken: string) {
//     if (!this.supabase) {
//       throw new ServiceUnavailableException('Supabase client is not configured');
//     }

//     const { data, error } = await this.supabase.auth.getUser(accessToken);
//     if (error || !data.user) {
//       throw new UnauthorizedException('Invalid Supabase session');
//     }

//     return data.user;
//   }
// }

// import { Injectable, UnauthorizedException } from '@nestjs/common';
// import { JwtService } from '@nestjs/jwt';
// import * as bcrypt from 'bcryptjs';
// import { PgService } from '../prisma/prisma.service';

// @Injectable()
// export class AuthService {
//   constructor(
//     private readonly pg: PgService,  // Remove Supabase injection
//     private readonly jwt: JwtService,
//   ) {}

//   // async login(email: string, password: string) {
//   //   const { rows } = await this.pg.client.query(
//   //     'SELECT id, email, password_hash FROM users WHERE email = $1',
//   //     [email],
//   //   );
//   //   const user = rows[0];
//   //   if (!user) throw new UnauthorizedException('Invalid credentials');

//   //   const ok = await bcrypt.compare(password, user.password_hash);
//   //   if (!ok) throw new UnauthorizedException('Invalid credentials');

//   //   const token = await this.jwt.signAsync({ sub: user.id, email: user.email });
//   //   return { accessToken: token, user: { id: user.id, email: user.email } };

//   async login(email: string, password: string) {
//   console.log('🔐 Login attempt for email:', email);
//   const { rows } = await this.pg.client.query(
//     'SELECT id, email, password_hash FROM users WHERE email = $1',
//     [email],
//   );
//   console.log('📦 Rows from DB:', rows);
//   const user = rows[0];
//   if (!user) {
//     console.log('❌ User not found');
//     throw new UnauthorizedException('Invalid credentials');
//   }
//   console.log('🔑 Stored hash:', user.password_hash);
//   const ok = await bcrypt.compare(password, user.password_hash);
//   console.log('✅ Compare result:', ok);
//   if (!ok) {
//     console.log('❌ Password mismatch');
//     throw new UnauthorizedException('Invalid credentials');
//   }
//   const token = await this.jwt.signAsync({ sub: user.id, email: user.email });
//   console.log('🎫 Token generated');
//   return { accessToken: token, user: { id: user.id, email: user.email } };

//   }
// }

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PrismaService } from '../prisma/prisma.service'; // assume you have a PrismaService

@Injectable()
export class AuthService {
  private supabase: SupabaseClient;

  constructor(
    private readonly prisma: PrismaService, // Prisma client
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {
    const supabaseUrl = this.config.get<string>('SUPABASE_AUTH_URL');
    const supabaseKey = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials missing');
    }
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async loginWithSupabaseToken(accessToken: string) {
    // 1. Verify the token with Supabase
    const { data, error } = await this.supabase.auth.getUser(accessToken);
    if (error || !data.user) {
      throw new UnauthorizedException('Invalid Supabase token');
    }

    const supabaseUser = data.user;

    // 2. Find or create user in local database (using Prisma)
    let user = await this.prisma.user.findUnique({
      where: { email: supabaseUser.email },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          id: supabaseUser.id, // use the Supabase UUID
          email: supabaseUser.email,
          username: supabaseUser.email.split('@')[0], // or use user_metadata.full_name
        },
      });
    }

    // 3. Issue your own JWT (optional, but keeps the existing flow)
    const token = await this.jwt.signAsync({
      sub: user.id,
      email: user.email,
    });

    return {
      accessToken: token,
      user: { id: user.id, email: user.email },
    };
  }
}