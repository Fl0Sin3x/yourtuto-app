import { apiClient } from './client';
import type { Comment, ApiCollection } from '../types';

export const commentsApi = {
  getByTutorial: async (tutorialId: number): Promise<Comment[]> => {
    const { data } = await apiClient.get<ApiCollection<Comment>>(
      `/api/tutorials/${tutorialId}/comments`,
    );
    return data.member ?? [];
  },

  create: async (tutorialId: number, content: string): Promise<Comment> => {
    const { data } = await apiClient.post<Comment>('/api/comments', {
      content,
      tutorial: `/api/tutorials/${tutorialId}`,
    });
    return data;
  },

  update: async (id: number, content: string): Promise<Comment> => {
    const { data } = await apiClient.patch<Comment>(`/api/comments/${id}`, { content }, {
      headers: { 'Content-Type': 'application/merge-patch+json' },
    });
    return data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/comments/${id}`);
  },
};
