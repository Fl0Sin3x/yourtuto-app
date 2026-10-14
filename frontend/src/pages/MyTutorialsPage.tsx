import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tutorialsApi } from '../api/tutorials';
import { apiClient } from '../api/client';
import { useAuthStore } from '../store/authStore';

interface TutorialStat {
  viewCount: number;
  avgRating: number | null;
  ratingCount: number;
  commentCount: number;
}

function formatViews(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
}

export function MyTutorialsPage() {
  const navigate  = useNavigate();
  const qc        = useQueryClient();
  const { user, isAuthenticated } = useAuthStore();

  const { data, isLoading } = useQuery({
    queryKey: ['my-tutorials', user?.id],
    queryFn: () => tutorialsApi.getAll({
      author: `/api/users/${user!.id}`,
      order:  { createdAt: 'desc' },
    }),
    enabled: !!user,
  });

  const { data: statsMap = {} } = useQuery<Record<number, TutorialStat>>({
    queryKey: ['my-tutorial-stats', user?.id],
    queryFn: async () => {
      const { data } = await apiClient.get<Record<number, TutorialStat>>(`/api/users/${user!.id}/tutorial-stats`);
      return data;
    },
    enabled: !!user,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => tutorialsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-tutorials'] });
      qc.invalidateQueries({ queryKey: ['tutorials'] });
    },
  });

  if (!isAuthenticated()) {
    navigate('/login');
    return null;
  }

  const tutorials = data?.member ?? [];

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-text mb-1">Mes tutoriels</h1>
          <p className="text-sm text-muted">{tutorials.length} tutoriel{tutorials.length !== 1 ? 's' : ''} publié{tutorials.length !== 1 ? 's' : ''}</p>
        </div>
        <Link
          to="/tutorials/create"
          className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-800 text-white rounded-xl text-sm font-medium transition-colors shadow-sm shadow-violet-500/20"
        >
          <span className="text-base leading-none">+</span>
          Nouveau
        </Link>
      </div>

      {isLoading && (
        <div className="flex justify-center mt-20">
          <div className="w-8 h-8 border-3 border-violet-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!isLoading && tutorials.length === 0 && (
        <div className="text-center mt-20">
          <div className="w-14 h-14 rounded-2xl bg-surface border border-border flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-muted">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <p className="font-semibold text-text mb-1">Aucun tutoriel pour l'instant</p>
          <p className="text-sm text-muted mb-5">Partage tes connaissances avec la communauté</p>
          <Link
            to="/tutorials/create"
            className="inline-flex px-5 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-medium hover:bg-violet-800 transition-colors shadow-sm shadow-violet-500/20"
          >
            Créer mon premier tutoriel
          </Link>
        </div>
      )}

      {!isLoading && tutorials.length > 0 && (
        <div className="flex flex-col gap-3">
          {tutorials.map((tuto) => (
            <div
              key={tuto.id}
              className="bg-surface border border-border rounded-2xl p-5 flex items-start justify-between gap-4 hover:border-violet-600/30 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                    tuto.published
                      ? 'text-success border-success/20 bg-success/8'
                      : 'text-warning border-warning/20 bg-warning/8'
                  }`}>
                    {tuto.published ? 'Publié' : 'Brouillon'}
                  </span>
                  <span className="text-xs text-muted">
                    {new Date(tuto.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>

                <h2 className="font-semibold text-text text-sm leading-snug truncate">{tuto.title}</h2>

                {tuto.description && (
                  <p className="text-xs text-muted mt-1 line-clamp-1">{tuto.description}</p>
                )}

                {tuto.categories.length > 0 && (
                  <div className="flex gap-1.5 mt-2 flex-wrap">
                    {tuto.categories.map((cat) => (
                      <span key={cat.id} className="text-xs text-muted border border-border px-2 py-0.5 rounded-full">{cat.name}</span>
                    ))}
                  </div>
                )}

                {/* Stats */}
                {statsMap[tuto.id] && (
                  <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border">
                    <span className="flex items-center gap-1.5 text-xs text-zinc-500">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 6s2-4 5-4 5 4 5 4-2 4-5 4-5-4-5-4z" stroke="currentColor" strokeWidth="1.2"/><circle cx="6" cy="6" r="1.5" stroke="currentColor" strokeWidth="1.2"/></svg>
                      <span className="font-medium text-zinc-700">{formatViews(statsMap[tuto.id].viewCount)}</span> vues
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-zinc-500">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1l1.4 2.8L10.5 4l-2.25 2.2.53 3.1L6 7.75 3.22 9.3l.53-3.1L1.5 4l3.1-.45z" stroke="currentColor" strokeWidth="1.1"/></svg>
                      {statsMap[tuto.id].avgRating
                        ? <><span className="font-medium text-zinc-700">{statsMap[tuto.id].avgRating}</span> ({statsMap[tuto.id].ratingCount})</>
                        : <span className="text-zinc-400">Pas encore noté</span>
                      }
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-zinc-500">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 2.5h10v6.5a1 1 0 01-1 1H2a1 1 0 01-1-1V2.5zm0 0l5 4 5-4" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>
                      <span className="font-medium text-zinc-700">{statsMap[tuto.id].commentCount}</span> commentaire{statsMap[tuto.id].commentCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Link
                  to={`/tutorials/${tuto.id}/edit`}
                  className="px-3 py-1.5 text-xs font-medium text-violet-600 border border-violet-600/30 bg-violet-50 rounded-lg hover:bg-violet-600/15 transition-colors"
                >
                  Modifier
                </Link>
                <button
                  onClick={() => {
                    if (confirm('Supprimer ce tutoriel ?')) deleteMutation.mutate(tuto.id);
                  }}
                  disabled={deleteMutation.isPending}
                  className="px-3 py-1.5 text-xs font-medium text-danger border border-danger/20 bg-danger/5 rounded-lg hover:bg-danger/10 transition-colors disabled:opacity-50"
                >
                  Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
