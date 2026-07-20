import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import {
  MAIL_SERVICE,
  type IMailService,
} from '../../infrastructure/mail/mail.interface';

export interface NotificationEvent {
  type:
    | 'LATE_ASN'
    | 'HOLD_PLACED'
    | 'ADJUSTMENT_PENDING'
    | 'ORDER_LATE'
    | 'GENERIC';
  subject: string;
  body: string;
  to?: string[];
  meta?: Record<string, unknown>;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly recent: Array<NotificationEvent & { at: string }> = [];

  constructor(
    @Optional() @Inject(MAIL_SERVICE) private readonly mail?: IMailService,
  ) {}

  listRecent(limit = 50) {
    return this.recent.slice(0, limit);
  }

  async notify(event: NotificationEvent) {
    const entry = { ...event, at: new Date().toISOString() };
    this.recent.unshift(entry);
    if (this.recent.length > 200) this.recent.pop();

    this.logger.log(`[${event.type}] ${event.subject}`);

    const recipients = event.to?.length
      ? event.to
      : [process.env.NOTIFY_DEFAULT_TO || 'admin@wms.local'];

    if (!this.mail) {
      return { queued: false, reason: 'mail_not_configured', recipients };
    }

    try {
      for (const to of recipients) {
        await this.mail.send({
          to,
          subject: `[WMS] ${event.subject}`,
          text: event.body,
          html: `<p>${event.body.replace(/\n/g, '<br/>')}</p>`,
        });
      }
      return { queued: true, recipients };
    } catch (err) {
      this.logger.warn(`Mail send failed: ${(err as Error).message}`);
      return { queued: false, reason: 'mail_failed', recipients };
    }
  }
}
