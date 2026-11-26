import { Badge, type BadgeProps } from '@mantine/core';
import { IconClock } from '@tabler/icons-react';

/** Бейдж длительности типа встречи: «30 мин» */
export function DurationBadge({
  minutes,
  style,
}: {
  minutes: number;
  style?: BadgeProps['style'];
}) {
  return (
    <Badge variant="light" color="orange" leftSection={<IconClock size={12} />} style={style}>
      {minutes} мин
    </Badge>
  );
}
