import { Container, Stack, Title } from '@mantine/core';
import { EventTypesSection } from './admin/EventTypesSection.tsx';
import { UpcomingBookingsSection } from './admin/UpcomingBookingsSection.tsx';

export function AdminPage() {
  return (
    <Container size="lg" py="xl">
      <Title order={1} mb="lg">
        Админка
      </Title>
      <Stack gap="xl">
        <UpcomingBookingsSection />
        <EventTypesSection />
      </Stack>
    </Container>
  );
}
