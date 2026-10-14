export type TutorialSource = 'community' | 'youtube' | 'devto' | 'reddit' | 'medium' | 'recipe' | 'instructables' | 'generated' | 'dev';

export interface User {
  id: number;
  email: string;
  username: string;
  avatar: string | null;
  profilePicture: string | null;
  bio: string | null;
  createdAt: string;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  description: string | null;
}

export interface Tag {
  id: number;
  name: string;
  slug: string;
}

export interface Tutorial {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  content: string | null;
  externalUrl: string | null;
  thumbnailUrl: string | null;
  source: TutorialSource;
  externalId: string | null;
  difficulty: 'beginner' | 'intermediate' | 'advanced' | null;
  duration: string | null;
  viewCount: number;
  published: boolean;
  createdAt: string;
  updatedAt: string | null;
  author: Pick<User, 'id' | 'username' | 'avatar' | 'profilePicture'> | null;
  categories: Category[];
  tags: Tag[];
}

export interface ApiCollection<T> {
  member: T[];
  totalItems?: number;
  view?: { next?: string; previous?: string; first?: string; last?: string };
}

export interface Comment {
  id: number;
  content: string;
  author: Pick<User, 'id' | 'username' | 'avatar' | 'profilePicture'>;
  createdAt: string;
}

export interface AuthTokens {
  token: string;
}
