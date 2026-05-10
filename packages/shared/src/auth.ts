import { z } from 'zod';

export interface AuthContext {
  userId: string;
  email: string;
}

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email()
  .max(254);

export const nameSchema = z.string().trim().min(1).max(80);

export const passwordSchema = z.string().min(10).max(128);

export const signupBodySchema = z
  .object({
    email: emailSchema,
    name: nameSchema,
    password: passwordSchema,
  })
  .strip();

export const credentialsVerifyBodySchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
  })
  .strip();

export const forgotPasswordBodySchema = z
  .object({
    email: emailSchema,
  })
  .strip();

export const resetPasswordBodySchema = z
  .object({
    token: z.string().min(1),
    newPassword: passwordSchema,
  })
  .strip();

export type SignupBody = z.infer<typeof signupBodySchema>;
export type CredentialsVerifyBody = z.infer<typeof credentialsVerifyBodySchema>;
export type ForgotPasswordBody = z.infer<typeof forgotPasswordBodySchema>;
export type ResetPasswordBody = z.infer<typeof resetPasswordBodySchema>;
