import 'dayjs/locale/ru';
import { Stack, Text } from '@mantine/core';
import { Calendar } from '@mantine/dates';
import { formatDayShort } from '../../ownerTime.ts';
import { freeSlotCount, type SlotDays } from './slotDays.ts';

// Календарь красит выбранный день основным цветом темы, а акцент приложения — оранжевый
const SELECTED_DAY_STYLE = {
  backgroundColor: 'var(--mantine-color-orange-filled)',
  color: 'var(--mantine-color-white)',
};

/**
 * Календарь-месяц окна записи: активны только дни окна, у каждого число свободных слотов.
 * Даты — строки `YYYY-MM-DD` из ответа сервера, пояс браузера на них не влияет.
 */
export function SlotCalendar({
  days,
  selectedDay,
  onSelectDay,
}: {
  days: SlotDays;
  selectedDay: string;
  onSelectDay: (day: string) => void;
}) {
  const windowDays = [...days.keys()];
  const freeCount = (day: string) => freeSlotCount(days.get(day) ?? []);
  const freeCountColor = (day: string) => {
    if (day === selectedDay) {
      return 'white';
    }
    return freeCount(day) > 0 ? 'orange' : 'dimmed';
  };

  return (
    <Calendar
      locale="ru"
      firstDayOfWeek={1}
      // Владелец работает ежедневно: выходные не выделяются
      weekendDays={[]}
      maxLevel="month"
      size="lg"
      hideOutsideDates
      defaultDate={selectedDay}
      minDate={windowDays[0]}
      maxDate={windowDays.at(-1)}
      excludeDate={(date) => !days.has(date)}
      nextLabel="Следующий месяц"
      previousLabel="Предыдущий месяц"
      getDayAriaLabel={(date) =>
        days.has(date)
          ? `${formatDayShort(date)}, свободных слотов: ${freeCount(date)}`
          : formatDayShort(date)
      }
      getDayProps={(date) =>
        days.has(date)
          ? {
              selected: date === selectedDay,
              'aria-pressed': date === selectedDay,
              style: date === selectedDay ? SELECTED_DAY_STYLE : undefined,
              onClick: () => onSelectDay(date),
            }
          : {}
      }
      renderDay={(date) => (
        <Stack gap={0} align="center">
          <span>{Number(date.slice(8))}</span>
          {days.has(date) && (
            <Text span size="xs" lh={1} c={freeCountColor(date)}>
              {freeCount(date)}
            </Text>
          )}
        </Stack>
      )}
    />
  );
}
