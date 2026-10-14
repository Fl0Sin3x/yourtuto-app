import { apiClient } from './client';

export interface FavoriteItem {
  id: number;
  itemSlug: string;
  source: string;
  title: string;
  thumbnailUrl: string | null;
  externalUrl: string | null;
  savedAt: string;
}

export const favoritesApi = {
  list: async (): Promise<FavoriteItem[]> => {
    const { data } = await apiClient.get<FavoriteItem[]>('/api/favorites');
    return data;
  },

  toggle: async (payload: {
    slug: string;
    source: string;
    title: string;
    thumbnailUrl?: string | null;
    externalUrl?: string | null;
  }): Promise<{ saved: boolean }> => {
    const { data } = await apiClient.post<{ saved: boolean }>('/api/favorites/toggle', payload);
    return data;
  },

  keys: async (): Promise<string[]> => {
    const { data } = await apiClient.get<string[]>('/api/favorites/keys');
    return data;
  },
};
