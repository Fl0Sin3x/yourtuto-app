import { apiClient } from './client';

export interface PathSummary {
  slug: string;
  title: string;
  description: string | null;
  level: string | null;
  icon: string | null;
  stepCount: number;
  completed: number;
  percent: number;
}

export interface PathStep {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  difficulty: string | null;
  duration: string | null;
  source: string;
  thumbnailUrl: string | null;
  done: boolean;
}

export interface PathDetail extends PathSummary {
  steps: PathStep[];
  nextStepId: number | null;
}

export const pathsApi = {
  list: async (): Promise<PathSummary[]> => (await apiClient.get<PathSummary[]>('/api/paths')).data,
  get: async (slug: string): Promise<PathDetail> => (await apiClient.get<PathDetail>(`/api/paths/${slug}`)).data,
};
