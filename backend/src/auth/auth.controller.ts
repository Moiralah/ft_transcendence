// import { Body, Controller, Post } from '@nestjs/common';
// import { AuthService } from './auth.service';

// class LoginDto {
//   email: string;
//   password: string;
// }

// @Controller('auth')
// export class AuthController {
//   constructor(private readonly auth: AuthService) {}

//   @Post('login')
//   async login(@Body() dto: LoginDto) {
//     console.log('📥 Received body:', dto);
//     return this.auth.login(dto.email, dto.password);
//   }
// }


import { Controller, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  async login(@Req() req: Request) {
    // Log what we have
    console.log('📥 req.body:', req.body);
    console.log('📥 req.rawBody:', (req as any).rawBody);

    let { email, password } = req.body;

    // If body is empty, parse rawBody manually
    if (!email || !password) {
      try {
        const parsed = JSON.parse((req as any).rawBody || '{}');
        email = parsed.email;
        password = parsed.password;
        console.log('📥 Manually parsed:', { email, password });
      } 
      catch (e) {
        console.error('❌ Failed to parse raw body:', e);
      }
    }

    if (!email || !password) {
      throw new Error('Missing email or password');
    }

    return this.auth.login(email, password);
  }
}