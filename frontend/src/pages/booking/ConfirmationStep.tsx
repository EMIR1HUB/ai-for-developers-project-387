import { Button, Card, Group, SimpleGrid, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { IconCheck } from '@tabler/icons-react';
import { useId, type ReactNode } from 'react';
import { Link } from 'react-router';
import type { Booking, OwnerProfile } from '../../api/generated/types.gen';
import { formatDayLong, formatTimeRange, ownerDate, timeZoneLabel } from '../../ownerTime.ts';
import { paths } from '../../paths.ts';

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Stack gap={2}>
      <Text size="xs" c="dimmed" tt="uppercase">
        {label}
      </Text>
      <Text>{children}</Text>
    </Stack>
  );
}

/** Шаг «подтверждение»: детали созданного бронирования из ответа сервера */
export function ConfirmationStep({ booking, owner }: { booking: Booking; owner: OwnerProfile }) {
  const titleId = useId();
  return (
    <Card
      component="section"
      aria-labelledby={titleId}
      withBorder
      radius="lg"
      padding="xl"
      maw={640}
      w="100%"
      mx="auto"
    >
      <Stack gap="lg">
        <Group gap="sm" wrap="nowrap">
          <ThemeIcon color="green" variant="light" size="lg" radius="xl">
            <IconCheck size={20} aria-hidden />
          </ThemeIcon>
          <Title order={1} size="h3" id={titleId}>
            Бронирование создано
          </Title>
        </Group>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <Detail label="Тип встречи">{booking.eventType.title}</Detail>
          <Detail label="Дата">{formatDayLong(ownerDate(booking.start))}</Detail>
          <Detail label="Время">
            {`${formatTimeRange(booking.start, booking.end)} по ${timeZoneLabel(owner.timeZone)}`}
          </Detail>
          <Detail label="Имя">{booking.guestName}</Detail>
          <Detail label="Email">{booking.guestEmail}</Detail>
          {booking.note && <Detail label="Заметка">{booking.note}</Detail>}
        </SimpleGrid>
        <Button
          component={Link}
          to={paths.catalog}
          variant="default"
          style={{ alignSelf: 'flex-start' }}
        >
          К каталогу
        </Button>
      </Stack>
    </Card>
  );
}
