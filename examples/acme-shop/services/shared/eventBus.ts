import type { DomainEvent, EventOf, EventType } from './events';
import { createLogger } from './logger';

type Listener<T extends EventType> = (event: EventOf<T>) => void | Promise<void>;

const log = createLogger('event-bus');

export class EventBus {
  private listeners = new Map<EventType, Listener<any>[]>();

  subscribe<T extends EventType>(type: T, listener: Listener<T>): () => void {
    const existing = this.listeners.get(type) ?? [];
    this.listeners.set(type, [...existing, listener]);
    return () => {
      const current = this.listeners.get(type) ?? [];
      this.listeners.set(type, current.filter((l) => l !== listener));
    };
  }

  async publish(event: DomainEvent): Promise<void> {
    const listeners = this.listeners.get(event.type) ?? [];
    for (const listener of listeners) {
      try {
        await listener(event);
      } catch (error) {
        log.error('listener failed', { type: event.type, error: String(error) });
      }
    }
  }
}

export const bus = new EventBus();
