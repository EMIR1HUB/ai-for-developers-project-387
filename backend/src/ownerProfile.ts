import type { OwnerProfile } from './generated/types.gen.ts';

/**
 * Профиль владельца: владелец один и задан заранее, редактирования профиля нет (спецификация EMIR1HUB/ai-for-developers-project-386#11).
 * Часовой пояс без летнего времени: на нём держатся окно записи и рабочие часы.
 */
export const OWNER_PROFILE: OwnerProfile = {
  name: 'Алия Нурланова',
  subtitle: 'Продуктовый дизайнер',
  timeZone: 'Asia/Almaty',
};
