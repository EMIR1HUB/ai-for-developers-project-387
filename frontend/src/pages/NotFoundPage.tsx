import { Button, Container, Text, Title } from '@mantine/core';
import { Link } from 'react-router';
import { paths } from '../paths.ts';

export function NotFoundPage() {
  return (
    <Container size="lg" py="xl">
      <Title order={1} mb="sm">
        Страница не найдена
      </Title>
      <Text c="dimmed" mb="lg">
        Такой страницы нет. Проверьте адрес или вернитесь на главную.
      </Text>
      <Button component={Link} to={paths.home} variant="default">
        На главную
      </Button>
    </Container>
  );
}
