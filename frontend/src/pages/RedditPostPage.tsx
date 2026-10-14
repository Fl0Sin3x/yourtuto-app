import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import MDEditor from '@uiw/react-md-editor';

interface RedditPost {
  id: string;
  title: string;
  selftext: string;
  url: string;
  permalink: string;
  thumbnail: string | null;
  subreddit: string;
  author: string | null;
  score: number;
  numComments: number;
  createdAt: string | null;
  isExternal: boolean;
}

export function RedditPostPage() {
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['reddit-post', id],
    queryFn: async () => {
      const { data } = await apiClient.get<RedditPost>(`/api/reddit-post/${id}`);
      return data;
    },
    staleTime: 1000 * 60 * 10,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center mt-20">
        <div className="w-8 h-8 border-3 border-warning border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <p className="text-danger font-semibold mb-2">Post introuvable.</p>
        <button onClick={() => navigate(-1)} className="text-sm text-violet-600 hover:text-violet-800 transition-colors">
          ← Retour
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">

      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        className="text-sm text-muted hover:text-text mb-6 flex items-center gap-1 transition-colors"
      >
        ← Retour
      </button>

      {/* Cover */}
      {data.thumbnail && (
        <img
          src={data.thumbnail}
          alt={data.title}
          className="w-full rounded-2xl mb-6 object-cover max-h-72 border border-border"
        />
      )}

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-warning/10 text-warning border border-warning/20">
            r/{data.subreddit}
          </span>
          <span className="text-xs text-muted border border-border px-2.5 py-1 rounded-full">
            Reddit
          </span>
        </div>

        <h1 className="text-2xl font-bold text-text mb-4 leading-snug">{data.title}</h1>

        <div className="flex items-center gap-4 text-sm text-muted">
          {data.author && (
            <span className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-full bg-warning/10 border border-warning/20 flex items-center justify-center text-warning text-xs font-bold">
                {data.author.slice(0, 1).toUpperCase()}
              </div>
              <span className="text-text font-medium">u/{data.author}</span>
            </span>
          )}
          {data.createdAt && (
            <span>· {new Date(data.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
          )}
          <span>· ↑ {data.score.toLocaleString()}</span>
          <span>· {data.numComments} commentaires</span>
        </div>
      </div>

      <hr className="border-border mb-6" />

      {/* Contenu */}
      {data.isExternal ? (
        /* Post de type lien */
        <div className="bg-surface2 border border-border rounded-2xl p-6 text-center">
          <p className="text-sm text-muted mb-4">Ce post Reddit pointe vers une ressource externe.</p>
          <a
            href={data.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-medium hover:bg-violet-800 transition-colors shadow-sm shadow-violet-500/20"
          >
            Ouvrir la ressource ↗
          </a>
        </div>
      ) : data.selftext ? (
        /* Post de type texte — rendu Markdown */
        <div data-color-mode="light">
          <MDEditor.Markdown
            source={data.selftext}
            style={{ background: 'transparent', color: 'inherit' }}
          />
        </div>
      ) : (
        <p className="text-muted text-sm">Aucun contenu disponible.</p>
      )}

      {/* Footer */}
      <div className="mt-10 pt-6 border-t border-border text-sm text-muted">
        Post original sur{' '}
        <a
          href={data.permalink}
          target="_blank"
          rel="noopener noreferrer"
          className="text-warning font-medium hover:text-warning/80 transition-colors"
        >
          Reddit →
        </a>
      </div>
    </div>
  );
}
