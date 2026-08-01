// import { PrismaClient } from '@prisma/client';
// import { Pool } from 'pg';
// import * as bcrypt from 'bcryptjs';

// @Injectable()
// export class PgService implements OnModuleInit {
//   private pool: Pool;

//   constructor() {
//     this.pool = new Pool({ connectionString: process.env.DATABASE_URL });
//   }

//   get client() {
//     return this.pool;
//   }

//   async onModuleInit() {
//     // Ensure a dev admin user exists with a hashed password.
//     const email = 'admin@family.test';
//     const password = 'password';
//     const exists = await this.pool.query('SELECT id FROM users WHERE email = $1', [email]);
//     if (exists.rowCount === 0) {
//       const hash = await bcrypt.hash(password, 10);
//       await this.pool.query(
//         'INSERT INTO users (email, password_hash) VALUES ($1, $2)',
//         [email, hash],
//       );
//       // eslint-disable-next-line no-console
//       console.log('[seed] created dev user admin@family.test / password');
//     }
//   }
// }

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}