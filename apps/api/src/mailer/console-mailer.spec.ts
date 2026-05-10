import { Logger } from '@nestjs/common';
import { afterEach, describe, it, expect, vi } from 'vitest';

import { ConsoleMailer } from './console-mailer';

describe('ConsoleMailer', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves without throwing', async () => {
    const mailer = new ConsoleMailer();
    await expect(
      mailer.send({ to: 'a@b.io', subject: 's', text: 't' }),
    ).resolves.toBeUndefined();
  });

  it('logs once per send via Nest Logger.log', async () => {
    const spy = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    const mailer = new ConsoleMailer();
    await mailer.send({ to: 'a@b.io', subject: 's', text: 't' });
    expect(spy).toHaveBeenCalledOnce();
  });

  it('the log message contains to, subject, and text', async () => {
    const spy = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    const mailer = new ConsoleMailer();
    await mailer.send({
      to: 'alice@example.com',
      subject: 'Reset your password',
      text: 'click https://example.com/reset?token=abc',
    });
    const message = String(spy.mock.calls[0]?.[0] ?? '');
    expect(message).toContain('alice@example.com');
    expect(message).toContain('Reset your password');
    expect(message).toContain('click https://example.com/reset?token=abc');
  });

  it('includes html when provided', async () => {
    const spy = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    const mailer = new ConsoleMailer();
    await mailer.send({
      to: 'a@b.io',
      subject: 's',
      text: 't',
      html: '<p>hello</p>',
    });
    const message = String(spy.mock.calls[0]?.[0] ?? '');
    expect(message).toContain('<p>hello</p>');
  });

  it('produces two distinct log entries for two calls', async () => {
    const spy = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    const mailer = new ConsoleMailer();
    await mailer.send({ to: 'one@x.io', subject: 'A', text: 'a' });
    await mailer.send({ to: 'two@x.io', subject: 'B', text: 'b' });
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
