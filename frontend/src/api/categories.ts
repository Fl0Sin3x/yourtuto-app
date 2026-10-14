import { apiClient } from './client';
import type { Category, ApiCollection } from '../types';

export const categoriesApi = {
  getAll: async (): Promise<Category[]> => {
    const { data } = await apiClient.get<ApiCollection<Category>>('/api/categories');
    return data.member;
  },
};
