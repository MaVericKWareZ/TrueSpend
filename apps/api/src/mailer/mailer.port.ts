export const MAILER = Symbol.for('Mailer');

export interface MailerSendArgs {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface Mailer {
  send(args: MailerSendArgs): Promise<void>;
}
