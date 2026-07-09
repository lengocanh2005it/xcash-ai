import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockPost = vi.fn();
vi.mock('axios', () => ({
  default: {
    post: mockPost,
    create: () => ({
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
      post: mockPost,
      get: vi.fn(),
    }),
  },
}));

const { authTokenManager } = await import('./api');

function makeValidJwt(expSec: number): string {
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({ sub: '1', exp: expSec }));
  const sig = btoa('fake-sig');
  return `${header}.${payload}.${sig}`;
}

beforeEach(() => {
  authTokenManager.resetLogoutState();
  authTokenManager.setAccessToken(null);
  mockPost.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AuthTokenManager', () => {
  it('getValidAccessToken returns stored token if not expired', async () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600;
    authTokenManager.setAccessToken(makeValidJwt(futureExp));
    const token = await authTokenManager.getValidAccessToken();
    expect(token).toBeTruthy();
    expect(token?.split('.')).toHaveLength(3);
  });

  it('getValidAccessToken returns null when no token set and refresh fails', async () => {
    mockPost.mockRejectedValueOnce(new Error('network'));
    const token = await authTokenManager.getValidAccessToken();
    expect(token).toBeNull();
  });

  it('getValidAccessToken refreshes when token is expired', async () => {
    const expiredToken = makeValidJwt(Math.floor(Date.now() / 1000) - 100);
    authTokenManager.setAccessToken(expiredToken);

    const freshToken = makeValidJwt(Math.floor(Date.now() / 1000) + 3600);
    mockPost.mockResolvedValueOnce({
      data: { data: { accessToken: freshToken } },
    });

    const token = await authTokenManager.getValidAccessToken();
    expect(token).toBe(freshToken);
    expect(mockPost).toHaveBeenCalledWith(
      expect.stringContaining('/auth/refresh'),
      {},
      { withCredentials: true },
    );
  });

  it('resetLogoutState clears logout flag', async () => {
    authTokenManager.markLogoutInitiated();
    const token1 = await authTokenManager.getValidAccessToken();
    expect(token1).toBeNull();

    authTokenManager.resetLogoutState();
    const freshToken = makeValidJwt(Math.floor(Date.now() / 1000) + 3600);
    mockPost.mockResolvedValueOnce({
      data: { data: { accessToken: freshToken } },
    });

    const token2 = await authTokenManager.getValidAccessToken();
    expect(token2).toBe(freshToken);
  });

  it('clearStaleRefreshSession clears token and calls logout', async () => {
    authTokenManager.setAccessToken(makeValidJwt(Math.floor(Date.now() / 1000) + 3600));
    mockPost.mockResolvedValueOnce({ data: { data: null } });

    await authTokenManager.clearStaleRefreshSession();
    const token = authTokenManager.getAccessToken();
    expect(token).toBeNull();
  });
});
