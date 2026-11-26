import { Alert, Button, Stack, Text } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { errorMessage } from '../api/errors.ts';

/**
 * Ошибка загрузки данных или отправки формы: текст сервера или сообщение о недоступности
 * сервера и «Повторить», которое повторяет неудавшееся действие
 */
export function ErrorAlert({
  title,
  error,
  onRetry,
}: {
  title: string;
  error: unknown;
  onRetry: () => void;
}) {
  return (
    <Alert color="red" variant="light" title={title} icon={<IconAlertCircle />}>
      <Stack gap="sm" align="flex-start">
        <Text size="sm">{errorMessage(error)}</Text>
        <Button variant="light" color="red" size="xs" onClick={onRetry}>
          Повторить
        </Button>
      </Stack>
    </Alert>
  );
}
