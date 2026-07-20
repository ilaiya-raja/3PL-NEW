export interface MailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

export interface MailMessage {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  from?: string;
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: MailAttachment[];
}

export interface IMailService {
  send(message: MailMessage): Promise<void>;
}

export const MAIL_SERVICE = Symbol('MAIL_SERVICE');
