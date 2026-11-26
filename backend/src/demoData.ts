import type { EventType } from './generated/types.gen.ts';
import type { Store } from './store.ts';

// Данные живут только в памяти, поэтому без демо-типов каталог после перезапуска был бы пустым
const DEMO_EVENT_TYPES: EventType[] = [
  {
    id: 'intro-15',
    title: 'Встреча 15 минут',
    description: 'Короткое знакомство: обсудим задачу и следующие шаги.',
    durationMinutes: 15,
  },
  {
    id: 'call-30',
    title: 'Встреча 30 минут',
    description: 'Подробный разговор о проекте с ответами на вопросы.',
    durationMinutes: 30,
  },
];

export function seedDemoData(store: Store): void {
  for (const eventType of DEMO_EVENT_TYPES) {
    store.addEventType(eventType);
  }
}
