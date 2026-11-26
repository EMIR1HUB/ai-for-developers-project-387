import { Card, Container, Group, SimpleGrid, Skeleton, Stack, Text, Title } from '@mantine/core';
import { IconCalendarOff } from '@tabler/icons-react';
import { Link } from 'react-router';
import { eventTypesList, ownerGet } from '../api/generated/sdk.gen';
import type { EventType, OwnerProfile } from '../api/generated/types.gen';
import { useApiQuery } from '../api/useApiQuery.ts';
import { DurationBadge } from '../components/DurationBadge.tsx';
import { ErrorAlert } from '../components/ErrorAlert.tsx';
import { OwnerAvatar } from '../components/OwnerAvatar.tsx';
import { bookingPath } from '../paths.ts';

const SKELETON_CARDS = 3;

function OwnerCard({ owner }: { owner: OwnerProfile }) {
  return (
    <Card component="section" aria-label="Профиль владельца" withBorder radius="lg" padding="lg">
      <Group wrap="nowrap">
        <OwnerAvatar name={owner.name} size="lg" />
        <div>
          <Text fw={600} size="lg">
            {owner.name}
          </Text>
          <Text c="dimmed" size="sm">
            {owner.subtitle}
          </Text>
        </div>
      </Group>
    </Card>
  );
}

function OwnerSkeleton() {
  return (
    <Card withBorder radius="lg" padding="lg" role="status" aria-label="Загрузка профиля владельца">
      <Group wrap="nowrap">
        <Skeleton height={56} circle />
        <div style={{ flex: 1 }}>
          <Skeleton height={16} width="40%" mb="xs" />
          <Skeleton height={12} width="30%" />
        </div>
      </Group>
    </Card>
  );
}

function OwnerSection() {
  const owner = useApiQuery(async () => (await ownerGet({ throwOnError: true })).data, []);

  switch (owner.status) {
    case 'loading':
      return <OwnerSkeleton />;
    case 'error':
      return (
        <ErrorAlert
          title="Не удалось загрузить профиль владельца"
          error={owner.error}
          onRetry={owner.retry}
        />
      );
    case 'success':
      return <OwnerCard owner={owner.data} />;
  }
}

function EventTypeCard({ eventType }: { eventType: EventType }) {
  return (
    // Вся карточка — ссылка на страницу бронирования, обёртка article сохраняет её смысл в списке
    <article>
      <Card
        component={Link}
        to={bookingPath(eventType.id)}
        h="100%"
        withBorder
        radius="lg"
        padding="lg"
        shadow="sm"
      >
        <Group justify="space-between" align="flex-start" wrap="nowrap" mb="xs">
          <Title order={3} size="h4">
            {eventType.title}
          </Title>
          <DurationBadge minutes={eventType.durationMinutes} />
        </Group>
        <Text c="dimmed" size="sm">
          {eventType.description}
        </Text>
      </Card>
    </article>
  );
}

function EventTypeSkeletons() {
  return (
    <SimpleGrid cols={{ base: 1, sm: 2 }} role="status" aria-label="Загрузка типов встреч">
      {Array.from({ length: SKELETON_CARDS }, (_, index) => (
        <Card key={index} withBorder radius="lg" padding="lg">
          <Skeleton height={20} width="60%" mb="sm" />
          <Skeleton height={12} mb={6} />
          <Skeleton height={12} width="80%" />
        </Card>
      ))}
    </SimpleGrid>
  );
}

function EmptyCatalog() {
  return (
    <Card withBorder radius="lg" padding="xl">
      <Stack align="center" gap="xs">
        <IconCalendarOff size={32} color="var(--mantine-color-dimmed)" aria-hidden />
        <Text c="dimmed" ta="center">
          Владелец пока не создал ни одного типа встречи
        </Text>
      </Stack>
    </Card>
  );
}

function EventTypeList() {
  const eventTypes = useApiQuery(
    async () => (await eventTypesList({ throwOnError: true })).data,
    [],
  );

  switch (eventTypes.status) {
    case 'loading':
      return <EventTypeSkeletons />;
    case 'error':
      return (
        <ErrorAlert
          title="Не удалось загрузить типы встреч"
          error={eventTypes.error}
          onRetry={eventTypes.retry}
        />
      );
    case 'success':
      if (eventTypes.data.length === 0) {
        return <EmptyCatalog />;
      }
      return (
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          {eventTypes.data.map((eventType) => (
            <EventTypeCard key={eventType.id} eventType={eventType} />
          ))}
        </SimpleGrid>
      );
  }
}

export function EventTypeCatalogPage() {
  return (
    <Container size="lg" py="xl">
      <Stack gap="lg">
        <OwnerSection />
        <Title order={1}>Выберите тип встречи</Title>
        <EventTypeList />
      </Stack>
    </Container>
  );
}
