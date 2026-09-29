import { systemClock } from '../shared/clock';
import { prefixedId } from '../shared/ids';
import { createLogger } from '../shared/logger';
import { MemoryRepo } from '../shared/memoryRepo';
import type { Channel, Notification } from './types';

const log = createLogger('notifications');
export const outbox = new MemoryRepo<Notification>();

export function sendNotification(userId: string, channel: Channel, content: { subject: string; body: string }): Notification {
  const notification = outbox.save({
    id: prefixedId('ntf'),
    userId,
    channel,
    subject: content.subject,
    body: content.body,
    sentAt: systemClock.now(),
  });
  log.info('notification sent', { userId, channel, subject: content.subject });
  return notification;
}
