import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { tutorialsApi } from '../api/tutorials';
import { TutorialCard } from '../components/tutorial/TutorialCard';
import type { User } from '../types';

interface ProfileStats {
  tutorialCount: number;
  totalViews: number;
  avgRating: number | null;
}

function formatViews(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
}

export function UserProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: user, isLoading, isError } = useQuery({
    queryKey: ['user', id],
    queryFn: async () => {
      const { data } = await apiClient.get<User>(`/api/users/${id}`);
      return data;
    },
    enabled: !!id,
  });

  const { data: stats } = useQuery<ProfileStats>({
    queryKey: ['user-profile-stats', id],
    queryFn: async () => {
      const { data } = await apiClient.get<ProfileStats>(`/api/users/${id}/profile-stats`);
      return data;
    },
    enabled: !!id,
  });

  const { data } = useQuery({
    queryKey: ['user-tutorials', id],
    queryFn: () => tutorialsApi.getAll({
      author: `/api/users/${id}`,
      order: { createdAt: 'desc' },
    }),
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
  });

  const tutorials = data?.member ?? [];

  if (isLoading) {
    return (
      <div className="flex justify-center mt-24">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isError || !user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <p className="font-semibold text-zinc-900 mb-2">Profil introuvable</p>
        <button onClick={() => navigate(-1)} className="text-sm text-violet-600 hover:text-violet-800 transition-colors">
          ← Retour
        </button>
      </div>
    );
  }

  const joinedDate = new Date(user.createdAt).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  return (
    <div className="min-h-screen bg-white">

      {/* Header */}
      <div className="bg-gradient-to-b from-zinc-950 to-zinc-900 text-white">
        <div className="max-w-4xl mx-auto px-5 pt-8 pb-12">
          <button
            onClick={() => navigate(-1)}
            className="text-zinc-400 hover:text-white text-sm flex items-center gap-1 mb-8 transition-colors"
          >
            ← Retour
          </button>

          <div className="flex items-start gap-5">
            {/* Avatar */}
            <div className="shrink-0">
              {user.profilePicture ? (
                <img
                  src={`/uploads/avatars/${user.profilePicture}`}
                  alt={user.username}
                  className="w-20 h-20 rounded-2xl object-cover ring-2 ring-white/10"
                />
              ) : user.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.username}
                  className="w-20 h-20 rounded-2xl object-cover ring-2 ring-white/10"
                />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-white text-2xl font-bold ring-2 ring-white/10">
                  {user.username?.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-white mb-1">@{user.username}</h1>
              {user.bio && (
                <p className="text-zinc-400 text-sm leading-relaxed max-w-xl mb-3">{user.bio}</p>
              )}
              <p className="text-xs text-zinc-500">Membre depuis {joinedDate}</p>
            </div>
          </div>

          {/* Stats bar */}
          {stats && (
            <div className="mt-8 flex items-center gap-6 flex-wrap">
              <div className="text-center">
                <p className="text-2xl font-bold text-white">{stats.tutorialCount}</p>
                <p className="text-xs text-zinc-400 mt-0.5">tuto{stats.tutorialCount !== 1 ? 's' : ''}</p>
              </div>
              <div className="w-px h-8 bg-zinc-700" />
              <div className="text-center">
                <p className="text-2xl font-bold text-white">{formatViews(stats.totalViews)}</p>
                <p className="text-xs text-zinc-400 mt-0.5">vues</p>
              </div>
              {stats.avgRating && (
                <>
                  <div className="w-px h-8 bg-zinc-700" />
                  <div className="text-center">
                    <p className="text-2xl font-bold text-white">{stats.avgRating}</p>
                    <p className="text-xs text-zinc-400 mt-0.5">note moy.</p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Tutorials */}
      <div className="max-w-6xl mx-auto px-5 py-10">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-6">
          Tutoriels publiés
        </h2>

        {tutorials.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-sm text-zinc-400">Aucun tutoriel publié pour l'instant.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {tutorials.map((t) => (
              <TutorialCard key={t.id} tutorial={t} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
