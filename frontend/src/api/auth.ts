import { apiClient } from './client';
import type { AuthTokens, User } from '../types';

export const authApi = {
  login: async (email: string, password: string): Promise<AuthTokens> => {
    const { data } = await apiClient.post<AuthTokens>('/api/login', { email, password }, {
      headers: { 'Content-Type': 'application/json' },
    });
    return data;
  },

  register: async (email: string, username: string, password: string): Promise<void> => {
    await apiClient.post('/api/register', { email, username, password }, {
      headers: { 'Content-Type': 'application/json' },
    });
  },

  me: async (): Promise<User> => {
    const { data } = await apiClient.get<User>('/api/me');
    return data;
  },

  updateProfile: async (payload: { username?: string; bio?: string; avatar?: string }): Promise<User> => {
    const { data } = await apiClient.patch<User>('/api/me', payload, {
      headers: { 'Content-Type': 'application/json' },
    });
    return data;
  },

  changePassword: async (currentPassword: string, newPassword: string): Promise<void> => {
    await apiClient.patch('/api/me/password', { currentPassword, newPassword }, {
      headers: { 'Content-Type': 'application/json' },
    });
  },

  uploadProfilePicture: async (file: File): Promise<{ profilePicture: string }> => {
    const form = new FormData();
    form.append('file', file);
    const { data } = await apiClient.post<{ profilePicture: string }>('/api/me/picture', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  deleteProfilePicture: async (): Promise<void> => {
    await apiClient.delete('/api/me/picture');
  },

  forgotPassword: async (email: string): Promise<void> => {
    await apiClient.post('/api/forgot-password', { email }, {
      headers: { 'Content-Type': 'application/json' },
    });
  },

  resetPassword: async (token: string, password: string): Promise<void> => {
    await apiClient.post('/api/reset-password', { token, password }, {
      headers: { 'Content-Type': 'application/json' },
    });
  },
};
