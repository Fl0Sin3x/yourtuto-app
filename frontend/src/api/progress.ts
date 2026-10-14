import { apiClient } from './client';

export interface ProgressItem {
  id: number;
  itemSlug: string;
  source: string;
  title: string;
  thumbnailUrl: string | null;
  externalUrl: string | null;
  completedAt: string;
  isDone: boolean;
}

export const progressApi = {
  list: async (): Promise<ProgressItem[]> => {
    const { data } = await apiClient.get<ProgressItem[]>('/api/progress');
    return data;
  },

  keys: async (): Promise<string[]> => {
    const { data } = await apiClient.get<string[]>('/api/progress/keys');
    return data;
  },

  toggleDone: async (id: number): Promise<{ isDone: boolean }> => {
    const { data } = await apiClient.post<{ isDone: boolean }>(`/api/progress/${id}/done`);
    return data;
  },

  toggle: async (payload: {
    slug: string;
    source: string;
    title: string;
    thumbnailUrl?: string | null;
    externalUrl?: string | null;
  }): Promise<{ completed: boolean }> => {
    const { data } = await apiClient.post<{ completed: boolean }>('/api/progress/toggle', payload);
    return data;
  },
};
