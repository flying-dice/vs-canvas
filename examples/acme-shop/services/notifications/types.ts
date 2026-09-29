export type Channel = 'email' | 'sms' | 'push';

export interface Notification {
  id: string;
  userId: string;
  channel: Channel;
  subject: string;
  body: string;
  sentAt: number;
}
