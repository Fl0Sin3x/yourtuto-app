import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import type { Tutorial } from '../types';
import { useProgressKeys, useToggleProgress } from '../hooks/useProgress';
import { useFavoriteKeys, useToggleFavorite } from '../hooks/useFavorites';
import { useAuthStore } from '../store/authStore';

interface YTInfo {
  title: string;
  description: string;
  channelTitle: string;
  publishedAt: string;
  viewCount: number | null;
  likeCount: number | null;
  duration: string | null;
  thumbnail: string | null;
}

function formatCount(n: number | null): string {
  if (n === null) return '';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}

function parseDuration(iso: string | null): string {
  if (!iso) return '';
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return '';
  const h = parseInt(m[1] ?? '0');
  const min = parseInt(m[2] ?? '0');
  const s = parseInt(m[3] ?? '0');
  if (h > 0) return `${h}:${String(min).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${min}:${String(s).padStart(2, '0')}`;
}

export function YouTubeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();

  // Fetch tutorial metadata from DB
  const { data: tutorial } = useQuery<Tutorial | null>({
    queryKey: ['youtube-tutorial', id],
    queryFn: async () => {
      const { data } = await apiClient.get<{ member: Tutorial[] }>(
        `/api/tutorials?source=youtube&itemsPerPage=1`,
        { params: { externalId: id } }
      );
      return data.member?.[0] ?? null;
    },
    enabled: !!id,
    retry: false,
  });

  // Fetch rich YouTube metadata via proxy
  const { data: ytInfo } = useQuery<YTInfo>({
    queryKey: ['youtube-info', id],
    queryFn: async () => {
      const { data } = await apiClient.get<YTInfo>(`/api/youtube/info/${id}`);
      return data;
    },
    enabled: !!id,
    retry: false,
    staleTime: 30 * 60 * 1000,
  });

  const { data: progressKeys = [] } = useProgressKeys();
  const { data: favoriteKeys = [] } = useFavoriteKeys();
  const toggleProgress = useToggleProgress();
  const toggleFavorite = useToggleFavorite();

  const progressKey = `${id}|youtube`;
  const isDone  = progressKeys.includes(progressKey);
  const isSaved = favoriteKeys.includes(progressKey);

  const title        = ytInfo?.title ?? tutorial?.title ?? 'Vidéo YouTube';
  const description  = ytInfo?.description ?? tutorial?.description ?? '';
  const thumbnailUrl = tutorial?.thumbnailUrl ?? ytInfo?.thumbnail ?? null;
  const externalUrl  = tutorial?.externalUrl ?? `https://www.youtube.com/watch?v=${id}`;

  const descLines = description.split('\n').filter(Boolean);

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Back */}
      <div className="max-w-5xl mx-auto px-5 pt-6 pb-2">
        <button
          onClick={() => navigate(-1)}
          className="text-zinc-400 hover:text-white text-sm flex items-center gap-1.5 transition-colors"
        >
          ← Retour
        </button>
      </div>

      {/* Embed */}
      <div className="max-w-5xl mx-auto px-5">
        <div className="relative w-full rounded-2xl overflow-hidden bg-black" style={{ paddingTop: '56.25%' }}>
          <iframe
            className="absolute inset-0 w-full h-full"
            src={`https://www.youtube.com/embed/${id}?rel=0&modestbranding=1`}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>

      {/* Info */}
      <div className="max-w-5xl mx-auto px-5 py-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="inline-flex items-center text-xs font-medium px-2.5 py-0.5 rounded-full bg-red-50 text-red-600 ring-1 ring-red-600/20">
                YouTube
              </span>
              {ytInfo?.channelTitle && (
                <span className="text-xs text-zinc-400">{ytInfo.channelTitle}</span>
              )}
              {parseDuration(ytInfo?.duration ?? null) && (
                <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-md">
                  {parseDuration(ytInfo?.duration ?? null)}
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold text-white leading-snug">{title}</h1>

            {/* Stats */}
            {(ytInfo?.viewCount || ytInfo?.likeCount || ytInfo?.publishedAt) && (
              <div className="flex items-center gap-4 mt-2 text-xs text-zinc-500">
                {ytInfo.viewCount !== null && (
                  <span>{formatCount(ytInfo.viewCount)} vues</span>
                )}
                {ytInfo.likeCount !== null && (
                  <span>👍 {formatCount(ytInfo.likeCount)}</span>
                )}
                {ytInfo.publishedAt && (
                  <span>
                    {new Date(ytInfo.publishedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.53 3.5 12 3.5 12 3.5s-7.53 0-9.38.55A3.02 3.02 0 0 0 .5 6.19C0 8.07 0 12 0 12s0 3.93.5 5.81a3.02 3.02 0 0 0 2.12 2.14C4.47 20.5 12 20.5 12 20.5s7.53 0 9.38-.55a3.02 3.02 0 0 0 2.12-2.14C24 15.93 24 12 24 12s0-3.93-.5-5.81zM9.75 15.52V8.48L15.83 12 9.75 15.52z"/>
              </svg>
              YouTube
            </a>

            {isAuthenticated() && (
              <>
                <button
                  onClick={() => toggleFavorite.mutate({ slug: id!, source: 'youtube', title, thumbnailUrl, externalUrl })}
                  disabled={toggleFavorite.isPending}
                  title={isSaved ? 'Retirer des favoris' : 'Sauvegarder'}
                  className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all ${
                    isSaved
                      ? 'bg-amber-400 border-amber-400 text-white'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-amber-400 hover:text-amber-400'
                  }`}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill={isSaved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>
                  </svg>
                </button>

                <button
                  onClick={() => toggleProgress.mutate({ slug: id!, source: 'youtube', title, thumbnailUrl, externalUrl })}
                  disabled={toggleProgress.isPending}
                  title={isDone ? 'Marquer comme non vu' : 'Marquer comme vu'}
                  className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all ${
                    isDone
                      ? 'bg-violet-600 border-violet-600 text-white'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-violet-500 hover:text-violet-400'
                  }`}
                >
                  <svg width="13" height="13" viewBox="0 0 10 10" fill="none">
                    <path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Description */}
        {descLines.length > 0 && (
          <div className="mt-6 bg-zinc-900 rounded-2xl p-5">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-3">Description</p>
            <div className="text-sm text-zinc-300 leading-relaxed space-y-2 line-clamp-[12]">
              {descLines.slice(0, 8).map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
