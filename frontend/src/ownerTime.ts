/**
 * Показ времени из ответов API. Сервер отдаёт время в поясе владельца со смещением
 * (`2026-11-24T09:00:00+05:00`), и его показывают как есть: дату и часы читают из строки,
 * без пересчёта в пояс браузера (спецификация EMIR1HUB/ai-for-developers-project-386#11, раздел «Интерфейс»).
 */

/** Дата из строки времени API в формате `YYYY-MM-DD` */
export function ownerDate(time: string): string {
  return time.slice(0, 10);
}

/** Часы и минуты из строки времени API: `09:00` */
export function ownerClock(time: string): string {
  return time.slice(11, 16);
}

/** Интервал в 24-часовом формате: `09:00–09:15` */
export function formatTimeRange(start: string, end: string): string {
  return `${ownerClock(start)}–${ownerClock(end)}`;
}

// Календарная дата без времени: форматируем её как полночь UTC в поясе UTC,
// тогда пояс браузера не сдвигает день
function calendarDate(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

const LONG_DAY = new Intl.DateTimeFormat('ru', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});
const SHORT_DAY = new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'long', timeZone: 'UTC' });

/** День по-русски: `вторник, 24 ноября` */
export function formatDayLong(date: string): string {
  return LONG_DAY.format(calendarDate(date));
}

/** День без дня недели: `24 ноября` */
export function formatDayShort(date: string): string {
  return SHORT_DAY.format(calendarDate(date));
}

// Русские названия городов поясов: `Intl` в браузерах отдаёт их по-разному (Chromium — `Almaty`),
// поэтому для пояса владельца название задано явно, остальные показываются по имени IANA
const TIME_ZONE_CITIES: Record<string, string> = {
  'Asia/Almaty': 'Алматы',
};

/** Подпись часового пояса владельца из профиля: `Алматы (UTC+5)` */
export function timeZoneLabel(timeZone: string): string {
  const city = TIME_ZONE_CITIES[timeZone] ?? timeZone.split('/').at(-1)?.replaceAll('_', ' ');
  const offset = new Intl.DateTimeFormat('ru', { timeZone, timeZoneName: 'shortOffset' })
    .formatToParts()
    .find((part) => part.type === 'timeZoneName')
    ?.value.replace('GMT', 'UTC');
  return `${city} (${offset})`;
}
