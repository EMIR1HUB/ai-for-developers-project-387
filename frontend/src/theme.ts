import { createTheme, type CSSVariablesResolver } from '@mantine/core';

/**
 * Тема с контрастом не ниже WCAG AA (4.5:1) для текста.
 * - `autoContrast`: подпись заливной кнопки выбирается по яркости фона (чёрный на `#fd7e14`, 8.17:1 вместо белого 2.57:1).
 * - `dimmed` светлой темы: `#495057` на `#ffffff`, 8.18:1 (было `#868e96`, 3.32:1).
 * - текст светлых бейджей и кнопок оранжевого: `#a63a00` на `#fff2e5`, 5.91:1 (было `#fd7e14`, ~2.4:1).
 */
export const theme = createTheme({
  autoContrast: true,
});

export const cssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {},
  light: {
    '--mantine-color-dimmed': '#495057',
    '--mantine-color-orange-light-color': '#a63a00',
  },
  dark: {},
});
