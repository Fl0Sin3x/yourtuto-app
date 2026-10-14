import { apiClient } from './client';

export interface CollectionSummary {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  public: boolean;
  tutorialIds: number[];
  count: number;
  updatedAt: string;
}

export interface CollectionItem {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  difficulty: string | null;
  source: string;
  thumbnailUrl: string | null;
}

export interface CollectionDetail extends CollectionSummary {
  owner: string | null;
  isOwner: boolean;
  tutorials: CollectionItem[];
}

export const collectionsApi = {
  mine: async (): Promise<CollectionSummary[]> => (await apiClient.get<CollectionSummary[]>('/api/collections')).data,
  get: async (slug: string): Promise<CollectionDetail> => (await apiClient.get<CollectionDetail>(`/api/c/${slug}`)).data,
  create: async (body: { title: string; description?: string; public?: boolean; tutorialId?: number }): Promise<CollectionSummary> =>
    (await apiClient.post<CollectionSummary>('/api/collections', body)).data,
  update: async (id: number, body: Partial<Pick<CollectionSummary, 'title' | 'description' | 'public' | 'tutorialIds'>>): Promise<CollectionSummary> =>
    (await apiClient.patch<CollectionSummary>(`/api/collections/${id}`, body, { headers: { 'Content-Type': 'application/json' } })).data,
  remove: async (id: number): Promise<void> => { await apiClient.delete(`/api/collections/${id}`); },
  addTutorial: async (id: number, tutorialId: number): Promise<CollectionSummary> =>
    (await apiClient.post<CollectionSummary>(`/api/collections/${id}/tutorials`, { tutorialId })).data,
  removeTutorial: async (id: number, tutorialId: number): Promise<CollectionSummary> =>
    (await apiClient.delete<CollectionSummary>(`/api/collections/${id}/tutorials/${tutorialId}`)).data,
};

export const collectionPath = (slug: string) => `/c/${slug}`;
