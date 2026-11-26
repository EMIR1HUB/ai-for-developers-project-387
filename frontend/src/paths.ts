import { generatePath } from 'react-router';

export const paths = {
  home: '/',
  catalog: '/book',
  booking: '/book/:eventTypeId',
  admin: '/admin',
} as const;

/** Адрес страницы бронирования типа встречи: `/book/<id>` */
export function bookingPath(eventTypeId: string): string {
  return generatePath(paths.booking, { eventTypeId });
}
