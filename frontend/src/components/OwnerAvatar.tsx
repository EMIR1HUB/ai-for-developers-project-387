import { Avatar, type MantineSize } from '@mantine/core';

// Аватар владельца — статичная картинка фронтенда, в профиле владельца его нет
const OWNER_AVATAR_URL = '/owner-avatar.svg';

export function OwnerAvatar({ name, size }: { name: string; size: MantineSize }) {
  return <Avatar src={OWNER_AVATAR_URL} alt={name} size={size} radius="xl" color="orange" />;
}
