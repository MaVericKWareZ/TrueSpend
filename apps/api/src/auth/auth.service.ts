import {
  BadRequestException,
  ConflictException,
  HttpException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AuditLoggerService } from '../audit/audit-logger.service';
import { MAILER, type Mailer } from '../mailer/mailer.port';
import { UsersService } from '../users/users.service';
import { PasswordHasher } from './password-hasher';
import { NOW_PROVIDER, type NowProvider, ResetTokenService } from './reset-token.service';

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);
  private dummyHash: string | undefined;

  constructor(
    private readonly users: UsersService,
    private readonly hasher: PasswordHasher,
    private readonly resetTokens: ResetTokenService,
    private readonly audit: AuditLoggerService,
    private readonly config: ConfigService,
    @Inject(MAILER) private readonly mailer: Mailer,
    @Inject(NOW_PROVIDER) private readonly now: NowProvider,
  ) {}

  async onModuleInit(): Promise<void> {
    this.dummyHash = await this.hasher.hash('not-a-real-password');
  }

  async signup(args: { email: string; name: string; password: string }): Promise<{ id: string }> {
    const passwordHash = await this.hasher.hash(args.password);
    try {
      const user = await this.users.create({
        email: args.email,
        name: args.name,
        passwordHash,
      });
      void this.audit.write({
        entityType: 'User',
        entityId: user.id,
        action: 'create',
        byUserId: user.id,
      });
      return { id: user.id };
    } catch (err) {
      if ((err as { code?: number })?.code === 11000) {
        throw new ConflictException({
          statusCode: 409,
          message: 'email_already_in_use',
        });
      }
      throw err;
    }
  }

  async verifyCredentials(args: {
    email: string;
    password: string;
  }): Promise<{ id: string; email: string; name: string }> {
    const user = await this.users.findByEmail(args.email);
    const hashToCheck = user?.passwordHash ?? this.dummyHash!;
    const ok = await this.hasher.verify(args.password, hashToCheck);
    if (!user || !ok) {
      throw new UnauthorizedException({
        statusCode: 401,
        message: 'Invalid email or password',
      });
    }
    return { id: user.id, email: user.email, name: user.name };
  }

  async forgotPassword(args: { email: string }): Promise<void> {
    const user = await this.users.findByEmail(args.email);
    if (!user) {
      throw new HttpException({ error: 'no_account_for_email' }, 404);
    }
    const { raw, hashed, expiresAt } = this.resetTokens.generate();
    await this.users.setResetToken(user.id, { hashed, expiresAt });

    const resetUrl = `${this.config.getOrThrow<string>('PUBLIC_APP_URL')}/reset-password?token=${raw}`;
    const minutes = this.config.getOrThrow<number>('RESET_TOKEN_TTL_MINUTES');
    await this.mailer.send({
      to: user.email,
      subject: 'Reset your Expense Tracker password',
      text: [
        `Hi ${user.name},`,
        '',
        'Click the link below to reset your password:',
        resetUrl,
        '',
        `This link expires in ${minutes} minutes. If you didn't request this, ignore this email.`,
      ].join('\n'),
    });
  }

  async resetPassword(args: { token: string; newPassword: string }): Promise<void> {
    const hashed = this.resetTokens.hashRaw(args.token);
    const user = await this.users.findByResetTokenHash(hashed);
    if (!user || !this.resetTokens.isValid(user, args.token, this.now())) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'invalid_or_expired_token',
      });
    }
    const newHash = await this.hasher.hash(args.newPassword);
    await this.users.clearResetTokenAndSetPassword(user.id, newHash);
    void this.audit.write({
      entityType: 'User',
      entityId: user.id,
      action: 'password_reset',
      byUserId: user.id,
    });
  }

}
