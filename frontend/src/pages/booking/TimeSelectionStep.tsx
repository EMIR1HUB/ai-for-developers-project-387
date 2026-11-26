import { Button, Card, Grid, Group, Skeleton, Stack, Text } from '@mantine/core';
import { Link } from 'react-router';
import type { EventType, OwnerProfile, Slot } from '../../api/generated/types.gen';
import type { QueryResult } from '../../api/useApiQuery.ts';
import { ErrorAlert } from '../../components/ErrorAlert.tsx';
import { TimeZoneNote } from '../../components/TimeZoneNote.tsx';
import { paths } from '../../paths.ts';
import { DaySlots } from './DaySlots.tsx';
import { EventTypeSummary } from './EventTypeSummary.tsx';
import { SlotCalendar } from './SlotCalendar.tsx';
import { defaultDay, groupSlotsByDay } from './slotDays.ts';

const SKELETON_SLOTS = 6;

function SlotsSkeleton() {
  return (
    <Grid gap="lg" role="status" aria-label="Загрузка слотов">
      <Grid.Col span={{ base: 12, sm: 7 }}>
        <Skeleton height={320} radius="lg" />
      </Grid.Col>
      <Grid.Col span={{ base: 12, sm: 5 }}>
        <Stack gap="xs">
          {Array.from({ length: SKELETON_SLOTS }, (_, index) => (
            <Skeleton key={index} height={36} radius="sm" />
          ))}
        </Stack>
      </Grid.Col>
    </Grid>
  );
}

function SlotPicker({
  slots,
  selectedDay,
  onSelectDay,
  selectedSlot,
  onSelectSlot,
}: {
  slots: readonly Slot[];
  selectedDay: string | null;
  onSelectDay: (day: string) => void;
  selectedSlot: Slot | null;
  onSelectSlot: (slot: Slot) => void;
}) {
  const days = groupSlotsByDay(slots);
  // Выбранный гостем день мог исчезнуть из окна после перезагрузки слотов
  const day = selectedDay !== null && days.has(selectedDay) ? selectedDay : defaultDay(days);

  if (day === null) {
    return (
      <Card withBorder radius="lg" padding="xl">
        <Text c="dimmed" ta="center">
          В окне записи не осталось слотов
        </Text>
      </Card>
    );
  }

  return (
    <Grid gap="lg">
      <Grid.Col span={{ base: 12, sm: 7 }}>
        <SlotCalendar days={days} selectedDay={day} onSelectDay={onSelectDay} />
      </Grid.Col>
      <Grid.Col span={{ base: 12, sm: 5 }}>
        <DaySlots
          day={day}
          slots={days.get(day) ?? []}
          selectedSlot={selectedSlot}
          onSelectSlot={onSelectSlot}
        />
      </Grid.Col>
    </Grid>
  );
}

/**
 * Шаг «выбор времени» страницы бронирования: карточка типа встречи, календарь окна записи
 * и слоты выбранного дня. Выбор хранит страница, чтобы он пережил переход между шагами.
 */
export function TimeSelectionStep({
  eventType,
  owner,
  slots,
  selectedDay,
  onSelectDay,
  selectedSlot,
  onSelectSlot,
  onContinue,
}: {
  eventType: EventType;
  owner: OwnerProfile;
  slots: QueryResult<Slot[]>;
  selectedDay: string | null;
  onSelectDay: (day: string) => void;
  selectedSlot: Slot | null;
  onSelectSlot: (slot: Slot) => void;
  onContinue: () => void;
}) {
  return (
    <Stack gap="lg">
      <Grid gap="lg">
        <Grid.Col span={{ base: 12, md: 4 }}>
          <EventTypeSummary eventType={eventType} owner={owner} selectedSlot={selectedSlot} />
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Stack gap="sm">
            {slots.status === 'loading' && <SlotsSkeleton />}
            {slots.status === 'error' && (
              <ErrorAlert
                title="Не удалось загрузить слоты"
                error={slots.error}
                onRetry={slots.retry}
              />
            )}
            {slots.status === 'success' && (
              <SlotPicker
                slots={slots.data}
                selectedDay={selectedDay}
                onSelectDay={onSelectDay}
                selectedSlot={selectedSlot}
                onSelectSlot={onSelectSlot}
              />
            )}
            <TimeZoneNote timeZone={owner.timeZone} />
          </Stack>
        </Grid.Col>
      </Grid>
      <Group justify="space-between">
        <Button component={Link} to={paths.catalog} variant="default">
          Назад
        </Button>
        <Button color="orange" disabled={selectedSlot === null} onClick={onContinue}>
          Продолжить
        </Button>
      </Group>
    </Stack>
  );
}
