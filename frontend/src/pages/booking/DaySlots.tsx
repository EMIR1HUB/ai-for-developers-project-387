import { Button, ScrollArea, Stack, Text, Title } from '@mantine/core';
import type { Slot } from '../../api/generated/types.gen';
import { formatDayLong, formatTimeRange } from '../../ownerTime.ts';

const SLOT_LIST_MAX_HEIGHT = 420;

/** Слоты выбранного дня: свободные можно выбрать, занятые неактивны */
export function DaySlots({
  day,
  slots,
  selectedSlot,
  onSelectSlot,
}: {
  day: string;
  slots: readonly Slot[];
  selectedSlot: Slot | null;
  onSelectSlot: (slot: Slot) => void;
}) {
  return (
    <Stack component="section" aria-label="Слоты дня" gap="sm">
      <Title order={2} size="h5">
        {formatDayLong(day)}
      </Title>
      {/* В дне до 33 слотов: список прокручивается, чтобы кнопки шагов оставались рядом */}
      <ScrollArea.Autosize mah={SLOT_LIST_MAX_HEIGHT} type="auto" offsetScrollbars>
        <Stack gap="xs">
          {slots.map((slot) => {
            const range = formatTimeRange(slot.start, slot.end);
            const status = slot.available ? 'Свободно' : 'Занято';
            const selected = slot.start === selectedSlot?.start;
            return (
              <Button
                key={slot.start}
                aria-label={`${range} ${status}`}
                aria-pressed={selected}
                variant={selected ? 'filled' : 'default'}
                color="orange"
                disabled={!slot.available}
                justify="space-between"
                fullWidth
                rightSection={
                  <Text span size="xs" c={selected ? undefined : 'dimmed'}>
                    {status}
                  </Text>
                }
                onClick={() => onSelectSlot(slot)}
              >
                {range}
              </Button>
            );
          })}
        </Stack>
      </ScrollArea.Autosize>
    </Stack>
  );
}
