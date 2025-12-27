import { renderHook, act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useFetchWithAuth } from '../useFetchWithAuth.js';
import { AuthContext } from '../../context/AuthContext.jsx';

const createResponse = ({ ok, status, body }) => ({
  ok,
  status,
  headers: new Headers({ 'content-type': 'application/json' }),
  json: vi.fn().mockResolvedValue(body),
});

describe('useFetchWithAuth', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reintenta la petición tras refrescar la sesión en un 401', async () => {
    const refreshSession = vi.fn().mockResolvedValue({});
    const wrapper = ({ children }) => (
      <AuthContext.Provider value={{ refreshSession }}>
        {children}
      </AuthContext.Provider>
    );

    const unauthorized = createResponse({ ok: false, status: 401, body: { message: 'Unauthorized' } });
    const success = createResponse({ ok: true, status: 200, body: { data: [{ id: 1, name: 'Demo' }] } });

    vi.spyOn(global, 'fetch').mockResolvedValueOnce(unauthorized).mockResolvedValueOnce(success);

    const { result } = renderHook(() => useFetchWithAuth('/test', { immediate: false }), { wrapper });

    let data;
    await act(async () => {
      data = await result.current.refetch();
    });

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(data).toEqual([{ id: 1, name: 'Demo' }]);
    expect(result.current.error).toBeNull();
  });
});
