import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const postPublicMock = vi.fn();

vi.mock('@/lib/api-public', () => ({
  postPublic: (...args: unknown[]) => postPublicMock(...args),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import { ApiError } from '@/lib/api';
import { ForgotPasswordForm } from './forgot-password-form';

describe('ForgotPasswordForm', () => {
  beforeEach(() => {
    postPublicMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows the success page on 200', async () => {
    postPublicMock.mockResolvedValueOnce({ status: 'ok' });
    render(<ForgotPasswordForm />);
    await userEvent.type(screen.getByLabelText(/email/i), 'alice@example.com');
    await userEvent.click(screen.getByRole('button', { name: /send reset link/i }));
    expect(await screen.findByText(/check your email/i)).toBeInTheDocument();
  });

  it('on 404, shows "No account found" with a sign-up link', async () => {
    postPublicMock.mockRejectedValueOnce(new ApiError(404, { error: 'no_account_for_email' }));
    render(<ForgotPasswordForm />);
    await userEvent.type(screen.getByLabelText(/email/i), 'nobody@example.com');
    await userEvent.click(screen.getByRole('button', { name: /send reset link/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/no account found/i);
    expect(screen.getByRole('link', { name: /sign up/i })).toBeInTheDocument();
  });
});
