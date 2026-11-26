import { Skeleton, Stack, Table, Text, Title } from '@mantine/core';
import { useId } from 'react';
import { bookingsList, ownerGet } from '../../api/generated/sdk.gen';
import type { Booking } from '../../api/generated/types.gen';
import { useApiQuery } from '../../api/useApiQuery.ts';
import { ErrorAlert } from '../../components/ErrorAlert.tsx';
import { TimeZoneNote } from '../../components/TimeZoneNote.tsx';
import { formatDayLong, formatTimeRange, ownerDate } from '../../ownerTime.ts';

const SKELETON_ROWS = 3;
// Ширина, ниже которой таблица не сжимается, а прокручивается по горизонтали (телефон)
const TABLE_MIN_WIDTH = 720;

function BookingRow({ booking }: { booking: Booking }) {
  return (
    <Table.Tr>
      <Table.Td style={{ whiteSpace: 'nowrap' }}>
        {`${formatDayLong(ownerDate(booking.start))}, ${formatTimeRange(booking.start, booking.end)}`}
      </Table.Td>
      <Table.Td>{booking.eventType.title}</Table.Td>
      <Table.Td>{booking.guestName}</Table.Td>
      <Table.Td>{booking.guestEmail}</Table.Td>
      <Table.Td>{booking.note ?? <Text c="dimmed">—</Text>}</Table.Td>
    </Table.Tr>
  );
}

function BookingsTable({ bookings, labelledBy }: { bookings: Booking[]; labelledBy: string }) {
  return (
    <Table.ScrollContainer minWidth={TABLE_MIN_WIDTH} type="native">
      <Table aria-labelledby={labelledBy} striped highlightOnHover verticalSpacing="sm">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Дата и время</Table.Th>
            <Table.Th>Тип встречи</Table.Th>
            <Table.Th>Имя</Table.Th>
            <Table.Th>Email</Table.Th>
            <Table.Th>Заметка</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {bookings.map((booking) => (
            <BookingRow key={booking.id} booking={booking} />
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}

/**
 * Раздел админки «Предстоящие бронирования»: бронирования всех типов встреч, которые ещё
 * не закончились, в порядке ответа сервера (по возрастанию начала)
 */
export function UpcomingBookingsSection() {
  const headingId = useId();
  // Профиль владельца нужен ради подписи пояса, в котором сервер отдаёт время
  const upcoming = useApiQuery(async () => {
    const [bookings, owner] = await Promise.all([
      bookingsList({ throwOnError: true }),
      ownerGet({ throwOnError: true }),
    ]);
    return { bookings: bookings.data, owner: owner.data };
  }, []);

  return (
    <section aria-labelledby={headingId}>
      <Title order={2} id={headingId} mb="md">
        Предстоящие бронирования
      </Title>
      {upcoming.status === 'loading' && (
        <Stack gap="xs" role="status" aria-label="Загрузка бронирований">
          {Array.from({ length: SKELETON_ROWS }, (_, index) => (
            <Skeleton key={index} height={36} />
          ))}
        </Stack>
      )}
      {upcoming.status === 'error' && (
        <ErrorAlert
          title="Не удалось загрузить бронирования"
          error={upcoming.error}
          onRetry={upcoming.retry}
        />
      )}
      {upcoming.status === 'success' &&
        (upcoming.data.bookings.length === 0 ? (
          <Text c="dimmed">Предстоящих бронирований нет</Text>
        ) : (
          <Stack gap="xs">
            <TimeZoneNote timeZone={upcoming.data.owner.timeZone} />
            <BookingsTable bookings={upcoming.data.bookings} labelledBy={headingId} />
          </Stack>
        ))}
    </section>
  );
}
