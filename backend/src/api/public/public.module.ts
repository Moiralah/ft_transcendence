import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from '../../prisma/prisma.module';
import { TreeModule } from '../tree/tree.module';
import { PublicApiKeyGuard } from './public-api-key.guard';
import { PublicController } from './public.controller';
import { PublicService } from './public.service';

@Module({
        imports: [
                PrismaModule,
				TreeModule,
                ThrottlerModule.forRoot([
                        {
                                ttl: 60000,
                                limit: 60,
                        },
                ]),
        ],
        controllers: [PublicController],
        providers: [PublicService, PublicApiKeyGuard]
})
export class PublicModule {}
