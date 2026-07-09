import { Module, DynamicModule } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_SDK_CLIENT } from './supabase.constant';

@Module({})
export class SupabaseModule {
  static forRoot(): DynamicModule {
    const provider = {
      provide: SUPABASE_SDK_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('SUPABASE_AUTH_URL');
        const key = config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
        if (!url || !key) {
          // Return a stub so the app still boots in local dev without Supabase.
          return null as unknown as SupabaseClient;
        }
        return createClient(url, key);
      },
    };
    return {
      module: SupabaseModule,
      providers: [provider],
      exports: [provider],
      global: true,
    };
  }
}

export default SupabaseModule.forRoot();
