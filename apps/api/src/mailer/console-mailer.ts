import { Injectable, Logger } from '@nestjs/common';

import type { Mailer, MailerSendArgs } from './mailer.port';

@Injectable()
export class ConsoleMailer implements Mailer {
  private readonly logger = new Logger(ConsoleMailer.name);

  async send(args: MailerSendArgs): Promise<void> {
    const lines = [
      `[Mailer] to=${args.to} subject="${args.subject}"`,
      args.text,
    ];
    if (args.html) lines.push('--- html ---', args.html);
    this.logger.log(lines.join('\n'));
  }
}
