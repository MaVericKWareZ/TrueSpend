'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { passwordSchema } from '@expense/shared';

import { ApiError } from '@/lib/api';
import { postPublic } from '@/lib/api-public';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';

const formSchema = z
  .object({
    newPassword: passwordSchema,
    confirmPassword: passwordSchema,
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type FormShape = z.infer<typeof formSchema>;

export function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const [error, setError] = useState<string | null>(null);
  const form = useForm<FormShape>({
    resolver: zodResolver(formSchema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  });

  const onSubmit = async (values: FormShape) => {
    setError(null);
    if (!token) {
      setError('This reset link is missing its token.');
      return;
    }
    try {
      await postPublic('/auth/reset-password', {
        token,
        newPassword: values.newPassword,
      });
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        setError('This reset link is invalid or has expired.');
        return;
      }
      setError(`Couldn't reset your password. Try again.`);
      return;
    }
    // Need the email for sign-in; fetch it would require an extra API call.
    // For MVP, redirect to sign-in with a success flag.
    router.push('/sign-in?reset=ok');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reset your password</CardTitle>
        <CardDescription>Pick a new password to sign back in.</CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New password</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="new-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm password</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="new-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}{' '}
                <Link href="/forgot-password" className="underline">Request a new link</Link>
              </p>
            ) : null}
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Resetting…' : 'Reset password'}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
