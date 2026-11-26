import { Card, Divider, Group, Stack, Text, Title } from '@mantine/core';
import { IconCalendarEvent, IconClock, IconTicket } from '@tabler/icons-react';
import type { EventType, OwnerProfile, Slot } from '../../api/generated/types.gen';
import { DurationBadge } from '../../components/DurationBadge.tsx';
import { OwnerAvatar } from '../../components/OwnerAvatar.tsx';
import { formatDayLong, formatTimeRange, ownerDate } from '../../ownerTime.ts';

/** Карточка типа встречи с владельцем и выбранными датой и временем */
export function EventTypeSummary({
  eventType,
  owner,
  selectedSlot,
  freeCount = null,
}: {
  eventType: EventType;
  owner: OwnerProfile;
  selectedSlot: Slot | null;
  /** Число свободных слотов открытого дня; `null` — строку не показывать */
  freeCount?: number | null;
}) {
  return (
    <Card component="section" aria-label="Тип встречи" withBorder radius="lg" padding="lg">
      <Stack gap="sm">
        <Group gap="sm" wrap="nowrap">
          <OwnerAvatar name={owner.name} size="md" />
          <Text fw={500}>{owner.name}</Text>
        </Group>
        <Title order={1} size="h3">
          {eventType.title}
        </Title>
        <DurationBadge minutes={eventType.durationMinutes} style={{ alignSelf: 'flex-start' }} />
        {eventType.description && (
          <Text c="dimmed" size="sm">
            {eventType.description}
          </Text>
        )}
        <Divider />
        {selectedSlot || freeCount !== null ? (
          <Stack gap={4}>
            {selectedSlot && (
              <>
                <Group gap="xs" wrap="nowrap">
                  <IconCalendarEvent size={16} aria-hidden />
                  <Text size="sm">{formatDayLong(ownerDate(selectedSlot.start))}</Text>
                </Group>
                <Group gap="xs" wrap="nowrap">
                  <IconClock size={16} aria-hidden />
                  <Text size="sm">{formatTimeRange(selectedSlot.start, selectedSlot.end)}</Text>
                </Group>
              </>
            )}
            {freeCount !== null && (
              <Group gap="xs" wrap="nowrap">
                <IconTicket size={16} aria-hidden />
                <Text size="sm">Свободно: {freeCount}</Text>
              </Group>
            )}
          </Stack>
        ) : (
          <Text c="dimmed" size="sm">
            Выберите день и время
          </Text>
        )}
      </Stack>
    </Card>
  );
}
