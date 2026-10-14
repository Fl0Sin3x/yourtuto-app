import { apiClient } from './client';
import type { Tutorial, ApiCollection } from '../types';

export interface TutorialFilters {
  page?: number;
  search?: string;
  source?: string;
  categories?: number;
  tags?: number;
  author?: string;
  difficulty?: string;
  order?: { createdAt?: 'asc' | 'desc'; viewCount?: 'asc' | 'desc' };
}

export const tutorialsApi = {
  getAll: async (filters: TutorialFilters = {}): Promise<ApiCollection<Tutorial>> => {
    const externalSources = ['youtube', 'devto', 'recipe'];
    const isSpecificExternal = !!filters.search && externalSources.includes(filters.source ?? '');
    const isAllSourcesSearch = !!filters.search && !filters.source;

    if (isAllSourcesSearch) {
      const [liveRes, dbRes] = await Promise.all([
        apiClient.get<ApiCollection<Tutorial>>('/api/live-search', {
          params: { q: filters.search, source: 'all' },
        }),
        apiClient.get<ApiCollection<Tutorial>>('/api/tutorials', {
          params: { search: filters.search, 'order[createdAt]': 'desc' },
        }),
      ]);
      const liveMembers = liveRes.data.member ?? [];
      // Keep community/generated/instructables + seeded recipes (no externalId)
      const dbMembers = (dbRes.data.member ?? []).filter(
        (t) => !externalSources.includes(t.source) || (t.source === 'recipe' && !t.externalId),
      );
      const merged = [...dbMembers, ...liveMembers];
      return { ...liveRes.data, member: merged, totalItems: merged.length };
    }

    if (isSpecificExternal) {
      if (filters.source === 'recipe') {
        // Merge live Spoonacular results + our seeded recipes from DB
        const [liveRes, dbRes] = await Promise.all([
          apiClient.get<ApiCollection<Tutorial>>('/api/live-search', {
            params: { q: filters.search, source: 'recipe', page: filters.page ?? 1 },
          }),
          apiClient.get<ApiCollection<Tutorial>>('/api/tutorials', {
            params: { source: 'recipe', search: filters.search, 'order[createdAt]': 'desc' },
          }),
        ]);
        const liveMembers = liveRes.data.member ?? [];
        const seeded = (dbRes.data.member ?? []).filter((t) => !t.externalId);
        const merged = [...seeded, ...liveMembers];
        return { ...liveRes.data, member: merged, totalItems: merged.length };
      }
      const params: Record<string, unknown> = {
        q:      filters.search,
        source: filters.source,
        page:   filters.page ?? 1,
      };
      const { data } = await apiClient.get<ApiCollection<Tutorial>>('/api/live-search', { params });
      return data;
    }

    const params: Record<string, unknown> = { page: filters.page ?? 1 };
    if (filters.search) params['search'] = filters.search;
    if (filters.source) params['source'] = filters.source;
    if (filters.categories) params['categories'] = filters.categories;
    if (filters.tags)   params['tags']   = filters.tags;
    if (filters.author) params['author'] = filters.author;
    if (filters.difficulty) params['difficulty'] = filters.difficulty;
    if (filters.order?.createdAt)  params['order[createdAt]']  = filters.order.createdAt;
    if (filters.order?.viewCount)  params['order[viewCount]']  = filters.order.viewCount;

    const { data } = await apiClient.get<ApiCollection<Tutorial>>('/api/tutorials', { params });
    return data;
  },

  getOne: async (id: number): Promise<Tutorial> => {
    const { data } = await apiClient.get<Tutorial>(`/api/tutorials/${id}`);
    return data;
  },

  create: async (payload: Partial<Tutorial>): Promise<Tutorial> => {
    const { data } = await apiClient.post<Tutorial>('/api/tutorials', payload);
    return data;
  },

  update: async (id: number, payload: Partial<Tutorial>): Promise<Tutorial> => {
    const { data } = await apiClient.patch<Tutorial>(`/api/tutorials/${id}`, payload, {
      headers: { 'Content-Type': 'application/merge-patch+json' },
    });
    return data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/tutorials/${id}`);
  },

  getDiverseFeed: async (): Promise<ApiCollection<Tutorial>> => {
    const { data } = await apiClient.get<ApiCollection<Tutorial>>('/api/diverse-feed');
    return data;
  },

  getRecommendations: async (): Promise<Tutorial[]> => {
    const { data } = await apiClient.get<Tutorial[]>('/api/recommendations');
    return data;
  },
};
