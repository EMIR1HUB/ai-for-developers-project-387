import {
  Badge,
  Button,
  Card,
  Container,
  List,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { IconArrowRight } from '@tabler/icons-react';
import { Link } from 'react-router';
import { paths } from '../paths.ts';

const FEATURES = [
  'Выбор типа встречи и удобного времени.',
  'Быстрое бронирование с подтверждением и заметкой для владельца.',
  'Создание типов встреч и просмотр предстоящих бронирований в админке.',
];

export function HomePage() {
  return (
    <Container size="lg" py={64}>
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing={48}>
        <Stack align="flex-start" gap="lg">
          <Badge variant="default" size="lg">
            Быстрая запись на звонок
          </Badge>
          <Title order={1} size={48}>
            Calendar
          </Title>
          <Text size="lg" c="dimmed">
            Забронируйте встречу за минуту: выберите тип встречи и удобное время.
          </Text>
          <Button
            component={Link}
            to={paths.catalog}
            size="md"
            color="orange"
            rightSection={<IconArrowRight size={16} />}
          >
            Записаться
          </Button>
        </Stack>
        <Card withBorder radius="lg" padding="xl" shadow="sm">
          <Title order={2} size="h3" mb="md">
            Возможности
          </Title>
          <List spacing="xs" c="dimmed">
            {FEATURES.map((feature) => (
              <List.Item key={feature}>{feature}</List.Item>
            ))}
          </List>
        </Card>
      </SimpleGrid>
    </Container>
  );
}
