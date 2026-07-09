import { Inject, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_SDK_CLIENT } from '../supabase/supabase.constant';

@Injectable()
export class AuthService {
  constructor(
    @Inject(SUPABASE_SDK_CLIENT)
    private readonly supabase: SupabaseClient | null,
    private readonly jwt: JwtService,
  ) {}

  async login(email: string, password: string) {
    if (!this.supabase) {
      throw new ServiceUnavailableException('Supabase client is not configured');
    }

    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.session?.access_token) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const user = await this.validateSessionToken(data.session.access_token);

    const token = await this.jwt.signAsync({ sub: user.id, email: user.email });
    return { access_token: token, user: { id: user.id, email: user.email } };
  }

  private async validateSessionToken(accessToken: string) {
    if (!this.supabase) {
      throw new ServiceUnavailableException('Supabase client is not configured');
    }

    const { data, error } = await this.supabase.auth.getUser(accessToken);
    if (error || !data.user) {
      throw new UnauthorizedException('Invalid Supabase session');
    }

    return data.user;
  }
}
