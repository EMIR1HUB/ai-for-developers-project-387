import { Anchor, AppShell, Button, Container, Group, Text } from '@mantine/core';
import { IconCalendarTime } from '@tabler/icons-react';
import { Link, Outlet, useMatch } from 'react-router';
import { paths } from '../paths.ts';

function HeaderLink({ to, label }: { to: string; label: string }) {
  const isActive = useMatch({ path: to, end: false }) !== null;

  return (
    <Button
      component={Link}
      to={to}
      variant={isActive ? 'light' : 'subtle'}
      color="gray"
      size="compact-md"
    >
      {label}
    </Button>
  );
}

export function AppLayout() {
  return (
    <AppShell header={{ height: 60 }}>
      <AppShell.Header>
        <Container size="lg" h="100%">
          <Group h="100%" justify="space-between" wrap="nowrap">
            <Anchor component={Link} to={paths.home} underline="never" c="dark">
              <Group gap={6} wrap="nowrap">
                <IconCalendarTime size={22} color="var(--mantine-color-orange-6)" />
                <Text fw={700}>Calendar</Text>
              </Group>
            </Anchor>
            <Group gap={4} component="nav" wrap="nowrap">
              <HeaderLink to={paths.catalog} label="Записаться" />
              <HeaderLink to={paths.admin} label="Админка" />
            </Group>
          </Group>
        </Container>
      </AppShell.Header>
      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
