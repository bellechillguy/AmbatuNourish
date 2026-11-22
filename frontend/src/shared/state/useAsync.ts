import { useCallback, useEffect, useRef, useState } from 'react';

import { toAppError, type AppError } from '../api/errors';

export interface AsyncState<T> {
  data: T | undefined;
  error: AppError | null;
  loading: boolean;
  reload: () => Promise<void>;
  setData: (d: T | undefined) => void;
}

/** Memuat data dari service dengan state loading / error / ulangi. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[], opts?: { enabled?: boolean }): AsyncState<T> {
  const enabled = opts?.enabled ?? true;
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<AppError | null>(null);
  const [loading, setLoading] = useState(enabled);
  const seq = useRef(0);

  const run = useCallback(async () => {
    const id = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const result = await fn();
      if (id === seq.current) setData(result);
    } catch (e) {
      if (id === seq.current) setError(toAppError(e));
    } finally {
      if (id === seq.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    if (enabled) void run();
    else setLoading(false);
  }, [run, enabled]);

  return { data, error, loading, reload: run, setData };
}
