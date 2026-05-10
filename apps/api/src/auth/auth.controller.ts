import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  credentialsVerifyBodySchema,
  forgotPasswordBodySchema,
  resetPasswordBodySchema,
  signupBodySchema,
  type CredentialsVerifyBody,
  type ForgotPasswordBody,
  type ResetPasswordBody,
  type SignupBody,
} from '@expense/shared';

import { validateBody } from '../common/pipes/zod-validation.pipe';
import { THROTTLE_TIER } from '../throttle/throttle.module';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('signup')
  @HttpCode(201)
  @Throttle({ [THROTTLE_TIER.default]: { limit: 5, ttl: 60 * 60_000 } })
  signup(@Body(validateBody(signupBodySchema)) body: SignupBody): Promise<{ id: string }> {
    return this.auth.signup(body);
  }

  @Post('credentials-verify')
  @HttpCode(200)
  @Throttle({ [THROTTLE_TIER.default]: { limit: 10, ttl: 15 * 60_000 } })
  verify(
    @Body(validateBody(credentialsVerifyBodySchema)) body: CredentialsVerifyBody,
  ): Promise<{ id: string; email: string; name: string }> {
    return this.auth.verifyCredentials(body);
  }

  @Post('forgot-password')
  @HttpCode(200)
  @Throttle({ [THROTTLE_TIER.default]: { limit: 5, ttl: 60 * 60_000 } })
  async forgot(
    @Body(validateBody(forgotPasswordBodySchema)) body: ForgotPasswordBody,
  ): Promise<{ status: 'ok' }> {
    await this.auth.forgotPassword(body);
    return { status: 'ok' };
  }

  @Post('reset-password')
  @HttpCode(200)
  @Throttle({ [THROTTLE_TIER.default]: { limit: 10, ttl: 60 * 60_000 } })
  async reset(
    @Body(validateBody(resetPasswordBodySchema)) body: ResetPasswordBody,
  ): Promise<{ status: 'ok' }> {
    await this.auth.resetPassword(body);
    return { status: 'ok' };
  }
}
