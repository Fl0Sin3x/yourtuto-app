import { apiClient } from './client';

export interface LabelCount { label: string; count: number }
export interface CatalogOverview {
  totals: { tutorials: number; newThisWeek: number; views: number; paths: number; publicCollections: number; learners: number; completionsWeek: number };
  bySource: LabelCount[];
  byDifficulty: LabelCount[];
  topTags: LabelCount[];
  mostViewed: { id: number; slug: string; title: string; viewCount: number }[];
  generatedAt: string;
}

export const statsApi = {
  overview: async (): Promise<CatalogOverview> => (await apiClient.get<CatalogOverview>('/api/stats/overview')).data,
};
