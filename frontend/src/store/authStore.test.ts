import { beforeEach, describe, expect, it } from 'vitest';
import { useAuthStore } from './authStore';

describe('authStore', () => {
  beforeEach(() => useAuthStore.setState({ token: null, user: null }));

  it('stores the token and reports authentication', () => {
    useAuthStore.getState().setToken('abc.def.ghi');
    expect(useAuthStore.getState().isAuthenticated()).toBe(true);
    expect(localStorage.getItem('jwt_token')).toBe('abc.def.ghi');
  });

  it('clears everything on logout', () => {
    useAuthStore.getState().setToken('abc.def.ghi');
    useAuthStore.getState().logout();
    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().isAuthenticated()).toBe(false);
    expect(localStorage.getItem('jwt_token')).toBeNull();
  });
});
