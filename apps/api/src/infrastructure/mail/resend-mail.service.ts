import { Injectable, NotImplementedException } from '@nestjs/common';
import type { IMailService, MailMessage } from './mail.interface';

@Injectable()
export class ResendMailService implements IMailService {
  send(_message: MailMessage): Promise<void> {
    throw new NotImplementedException('Resend mail provider is not implemented');
  }
}
