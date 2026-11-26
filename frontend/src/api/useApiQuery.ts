import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

export type QueryState<T> =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'success'; data: T };

/** Результат `useApiQuery`: состояние загрузки и `retry`, который повторяет запрос */
export type QueryResult<T> = QueryState<T> & { retry: () => void };

/**
 * Загружает данные при открытии страницы и при смене `deps`, без кэша (спецификация EMIR1HUB/ai-for-developers-project-386#11).
 * `load` вызывает SDK с `throwOnError: true`: ошибка API или сети попадает в состояние `error`.
 * `retry` повторяет загрузку.
 */
export function useApiQuery<T>(load: () => Promise<T>, deps: readonly unknown[]): QueryResult<T> {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; state: QueryState<T> } | null>(null);
  // Ключ запроса: пока ответ на текущий ключ не пришёл, состояние — загрузка
  const key = JSON.stringify([attempt, ...deps]);

  // load пересоздаётся на каждом рендере: держим последнюю версию в ref,
  // чтобы запрос перезапускался только по ключу
  const loadRef = useRef(load);
  useLayoutEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    let active = true;
    loadRef.current().then(
      (data) => active && setResult({ key, state: { status: 'success', data } }),
      (error: unknown) => active && setResult({ key, state: { status: 'error', error } }),
    );
    return () => {
      active = false;
    };
  }, [key]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  const state: QueryState<T> = result?.key === key ? result.state : { status: 'loading' };
  return { ...state, retry };
}
