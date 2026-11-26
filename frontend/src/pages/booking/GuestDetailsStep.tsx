import { Button, Card, Grid, Group, Stack, Textarea, TextInput, Title } from '@mantine/core';
import { useId, useState, type FormEvent } from 'react';
import { fieldErrors, isApiError, type FieldErrors } from '../../api/errors.ts';
import { bookingsCreate } from '../../api/generated/sdk.gen';
import type { Booking, EventType, OwnerProfile, Slot } from '../../api/generated/types.gen';
import { ErrorAlert } from '../../components/ErrorAlert.tsx';
import { EventTypeSummary } from './EventTypeSummary.tsx';

/** Данные гостя в форме. Их хранит страница, чтобы они пережили возврат к выбору времени */
export interface GuestValues {
  guestName: string;
  guestEmail: string;
  note: string;
}

/**
 * Шаг «данные гостя»: карточка типа встречи с выбранным слотом и форма. Поля проверяет сервер,
 * его ошибки показываются под полями. Если слот за это время заняли или он перестал
 * предлагаться, шаг отдаёт `message` сервера странице через `onSlotLost`.
 */
export function GuestDetailsStep({
  eventType,
  owner,
  slot,
  values,
  onChange,
  onBack,
  onBooked,
  onSlotLost,
}: {
  eventType: EventType;
  owner: OwnerProfile;
  slot: Slot;
  values: GuestValues;
  onChange: (values: GuestValues) => void;
  onBack: () => void;
  onBooked: (booking: Booking) => void;
  onSlotLost: (message: string) => void;
}) {
  const titleId = useId();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);

  const change = (field: keyof GuestValues) => (value: string) =>
    onChange({ ...values, [field]: value });

  async function submit() {
    setSubmitting(true);
    setErrors({});
    setSubmitError(null);
    try {
      const { data } = await bookingsCreate({
        body: { eventTypeId: eventType.id, start: slot.start, ...values },
        throwOnError: true,
      });
      onBooked(data);
    } catch (error) {
      if (isApiError(error) && (error.code === 'SLOT_TAKEN' || error.code === 'SLOT_NOT_OFFERED')) {
        onSlotLost(error.message);
      } else if (isApiError(error) && error.code === 'VALIDATION_ERROR') {
        setErrors(fieldErrors(error));
      } else {
        setSubmitError(error);
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submit();
  }

  return (
    <Grid gap="lg">
      <Grid.Col span={{ base: 12, md: 4 }}>
        <EventTypeSummary eventType={eventType} owner={owner} selectedSlot={slot} />
      </Grid.Col>
      <Grid.Col span={{ base: 12, md: 8 }}>
        <Card withBorder radius="lg" padding="lg">
          <form aria-labelledby={titleId} onSubmit={handleSubmit} noValidate>
            <Stack gap="md">
              <Title order={2} size="h4" id={titleId}>
                Ваши данные
              </Title>
              {submitError !== null && (
                <ErrorAlert
                  title="Не удалось создать бронирование"
                  error={submitError}
                  onRetry={() => void submit()}
                />
              )}
              <TextInput
                label="Имя"
                value={values.guestName}
                onChange={(event) => change('guestName')(event.currentTarget.value)}
                error={errors.guestName}
                autoComplete="name"
                required
              />
              <TextInput
                label="Email"
                type="email"
                value={values.guestEmail}
                onChange={(event) => change('guestEmail')(event.currentTarget.value)}
                error={errors.guestEmail}
                autoComplete="email"
                required
              />
              <Textarea
                label="Заметка"
                placeholder="Необязательно: о чём хотите поговорить"
                value={values.note}
                onChange={(event) => change('note')(event.currentTarget.value)}
                error={errors.note}
                rows={4}
              />
              <Group justify="space-between">
                <Button variant="default" onClick={onBack}>
                  Назад
                </Button>
                <Button type="submit" color="orange" loading={submitting}>
                  Забронировать
                </Button>
              </Group>
            </Stack>
          </form>
        </Card>
      </Grid.Col>
    </Grid>
  );
}
