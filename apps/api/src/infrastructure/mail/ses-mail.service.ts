import { Injectable, NotImplementedException } from '@nestjs/common';
import type { IMailService, MailMessage } from './mail.interface';

@Injectable()
export class SesMailService implements IMailService {
  send(_message: MailMessage): Promise<void> {
    throw new NotImplementedException('SES mail provider is not implemented');
  }
}
