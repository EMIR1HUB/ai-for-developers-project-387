import { Card, Divider, Group, Stack, Text, Title } from '@mantine/core';
import { IconCalendarEvent, IconClock } from '@tabler/icons-react';
import type { EventType, OwnerProfile, Slot } from '../../api/generated/types.gen';
import { DurationBadge } from '../../components/DurationBadge.tsx';
import { OwnerAvatar } from '../../components/OwnerAvatar.tsx';
import { formatDayLong, formatTimeRange, ownerDate } from '../../ownerTime.ts';

/** Карточка типа встречи с владельцем и выбранными датой и временем */
export function EventTypeSummary({
  eventType,
  owner,
  selectedSlot,
}: {
  eventType: EventType;
  owner: OwnerProfile;
  selectedSlot: Slot | null;
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
        {selectedSlot ? (
          <Stack gap={4}>
            <Group gap="xs" wrap="nowrap">
              <IconCalendarEvent size={16} aria-hidden />
              <Text size="sm">{formatDayLong(ownerDate(selectedSlot.start))}</Text>
            </Group>
            <Group gap="xs" wrap="nowrap">
              <IconClock size={16} aria-hidden />
              <Text size="sm">{formatTimeRange(selectedSlot.start, selectedSlot.end)}</Text>
            </Group>
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
