'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { forgotPasswordBodySchema, type ForgotPasswordBody } from '@expense/shared';

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

type Status = 'idle' | 'sent' | 'no-account' | 'error';

export function ForgotPasswordForm() {
  const [status, setStatus] = useState<Status>('idle');
  const form = useForm<ForgotPasswordBody>({
    resolver: zodResolver(forgotPasswordBodySchema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (values: ForgotPasswordBody) => {
    setStatus('idle');
    try {
      await postPublic('/auth/forgot-password', values);
      setStatus('sent');
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setStatus('no-account');
        return;
      }
      setStatus('error');
    }
  };

  if (status === 'sent') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Check your email</CardTitle>
          <CardDescription>
            We&apos;ve sent a reset link. The link expires in 60 minutes.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <p className="text-sm text-muted-foreground">
            Back to{' '}
            <Link href="/sign-in" className="underline">sign in</Link>
          </p>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Forgot your password?</CardTitle>
        <CardDescription>
          Enter your email and we&apos;ll send you a reset link.
        </CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" autoComplete="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {status === 'no-account' ? (
              <p role="alert" className="text-sm text-destructive">
                No account found for that email.{' '}
                <Link href="/signup" className="underline">Sign up instead?</Link>
              </p>
            ) : null}
            {status === 'error' ? (
              <p role="alert" className="text-sm text-destructive">
                Something went wrong. Try again.
              </p>
            ) : null}
          </CardContent>
          <CardFooter className="flex-col items-stretch gap-3">
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Sending…' : 'Send reset link'}
            </Button>
            <p className="text-sm text-muted-foreground text-center">
              Remembered it?{' '}
              <Link href="/sign-in" className="underline">Sign in</Link>
            </p>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
