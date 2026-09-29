import { registerNotificationSubscribers } from '../notifications';
import { registerOrderSubscribers } from '../orders';
import { reindexCatalog } from '../search';
import { config } from '../shared/config';
import { createLogger } from '../shared/logger';

const log = createLogger('gateway');

export { handleRequest } from './server';

export function boot(): void {
  registerOrderSubscribers();
  registerNotificationSubscribers();
  const indexed = reindexCatalog();
  log.info('gateway ready', { port: config.gateway.port, indexed });
}
