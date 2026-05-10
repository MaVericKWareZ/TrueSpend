import { MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { validateEnv } from './config/env';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { AuthBridge } from './auth/auth-bridge.middleware';
import { PUBLIC_AUTH_ROUTES } from './auth/public-auth-routes';
import { AuditModule } from './audit/audit.module';
import { ThrottleModule } from './throttle/throttle.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      envFilePath: ['.env.local', '.env'],
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>('MONGODB_URI'),
      }),
    }),
    ThrottleModule,
    AuthModule,
    AuditModule,
    HealthModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(AuthBridge).exclude(...PUBLIC_AUTH_ROUTES).forRoutes('*');
  }
}
