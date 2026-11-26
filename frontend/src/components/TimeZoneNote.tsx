import { Text } from '@mantine/core';
import { timeZoneLabel } from '../ownerTime.ts';

/** Подпись «Время указано по Алматы (UTC+5)»: сервер отдаёт время в поясе владельца */
export function TimeZoneNote({ timeZone }: { timeZone: string }) {
  return (
    <Text size="sm" c="dimmed">
      Время указано по {timeZoneLabel(timeZone)}
    </Text>
  );
}
