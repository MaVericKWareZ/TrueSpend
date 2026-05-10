import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const pushMock = vi.fn();
const signInMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('next-auth/react', () => ({
  signIn: (...args: unknown[]) => signInMock(...args),
}));

import { SignInForm } from './sign-in-form';

describe('SignInForm', () => {
  beforeEach(() => {
    pushMock.mockClear();
    signInMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('redirects to / on successful sign-in', async () => {
    signInMock.mockResolvedValueOnce({ ok: true, error: null });
    render(<SignInForm />);
    await userEvent.type(screen.getByLabelText(/email/i), 'alice@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'a'.repeat(10));
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(signInMock).toHaveBeenCalledWith(
      'credentials',
      expect.objectContaining({
        email: 'alice@example.com',
        password: 'a'.repeat(10),
        redirect: false,
      }),
    );
    expect(pushMock).toHaveBeenCalledWith('/');
  });

  it('renders the generic "Invalid email or password" error on failure', async () => {
    signInMock.mockResolvedValueOnce({ ok: false, error: 'CredentialsSignin' });
    render(<SignInForm />);
    await userEvent.type(screen.getByLabelText(/email/i), 'alice@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'a'.repeat(10));
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/invalid email or password/i);
    expect(pushMock).not.toHaveBeenCalled();
  });
});
