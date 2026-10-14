import { Link } from 'react-router-dom';
import type { Tutorial } from '../../types';
import { StarRating } from '../StarRating';
import { tutorialPath } from '../../seo/url';

interface SmartLinkProps {
  internal: boolean;
  href: string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

function SmartLink({ internal, href, className, style, children }: SmartLinkProps) {
  return internal
    ? <Link to={href} className={className} style={style}>{children}</Link>
    : <a href={href} target="_blank" rel="noopener noreferrer" className={className} style={style}>{children}</a>;
}

const DIFFICULTY_CONFIG: Record<string, { label: string; cls: string }> = {
  beginner:        { label: 'Débutant',      cls: 'text-emerald-600 bg-emerald-50 ring-emerald-600/20' },
  intermediate:    { label: 'Intermédiaire', cls: 'text-amber-600 bg-amber-50 ring-amber-600/20' },
  advanced:        { label: 'Avancé',        cls: 'text-red-600 bg-red-50 ring-red-600/20' },
  'débutant':      { label: 'Débutant',      cls: 'text-emerald-600 bg-emerald-50 ring-emerald-600/20' },
  'intermédiaire': { label: 'Intermédiaire', cls: 'text-amber-600 bg-amber-50 ring-amber-600/20' },
  'avancé':        { label: 'Avancé',        cls: 'text-red-600 bg-red-50 ring-red-600/20' },
};
const DIFFICULTY_FALLBACK = { label: '', cls: 'text-zinc-600 bg-zinc-50 ring-zinc-600/20' };

function formatViews(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
}

const SOURCE_CONFIG: Record<string, { label: string; cls: string }> = {
  community:     { label: 'Communauté',   cls: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' },
  youtube:       { label: 'YouTube',      cls: 'bg-red-50 text-red-600 ring-red-600/20' },
  devto:         { label: 'DEV.to',       cls: 'bg-violet-50 text-violet-700 ring-violet-600/20' },
  reddit:        { label: 'Reddit',       cls: 'bg-orange-50 text-orange-600 ring-orange-600/20' },
  medium:        { label: 'Medium',       cls: 'bg-sky-50 text-sky-700 ring-sky-600/20' },
  recipe:        { label: '🍳 Recette',   cls: 'bg-amber-50 text-amber-700 ring-amber-600/20' },
  instructables: { label: '🔧 DIY',      cls: 'bg-lime-50 text-lime-700 ring-lime-600/20' },
  generated:     { label: '✨ Bricolage', cls: 'bg-violet-50 text-violet-700 ring-violet-600/20' },
  dev:           { label: '💻 Dev',       cls: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20' },
};

interface Props {
  tutorial: Tutorial;
  rating?: { average: number; count: number };
}

export function TutorialCard({ tutorial, rating }: Props) {
  const cfg = SOURCE_CONFIG[tutorial.source] ?? {
    label: tutorial.source,
    cls:   'bg-zinc-100 text-zinc-600 ring-zinc-600/20',
  };

  const isDevTo    = tutorial.source === 'devto';
  const isReddit   = tutorial.source === 'reddit';
  const isRecipe   = tutorial.source === 'recipe';
  const isYouTube  = tutorial.source === 'youtube';
  const isExternal = tutorial.source !== 'community' && tutorial.source !== 'generated' && tutorial.source !== 'dev';

  const href = (() => {
    if (isDevTo)   return `/devto/${tutorial.externalId ?? tutorial.slug}`;
    if (isReddit)  return `/reddit/${(tutorial.externalId ?? tutorial.slug).replace('reddit-', '')}`;
    if (isYouTube) {
      const ytId = tutorial.externalId
        ?? tutorial.externalUrl?.match(/[?&]v=([^&]+)/)?.[1]
        ?? tutorial.externalUrl?.match(/youtu\.be\/([^?]+)/)?.[1];
      if (ytId) return `/youtube/${ytId}`;
    }
    if (isRecipe) {
      const extId = tutorial.externalId;
      if (extId?.startsWith('spoonacular-')) return `/recipe/${extId}`;
      if (extId) return `/recipe/${extId.replace('mealdb-', '')}`;
      return tutorialPath(tutorial);
    }
    if (!isExternal) return tutorialPath(tutorial);
    return tutorial.externalUrl ?? '#';
  })();

  const isInternalLink = !isExternal || isDevTo || isReddit || isRecipe || isYouTube;

  return (
    <div className="group flex flex-col bg-white rounded-2xl border border-zinc-200 overflow-hidden h-full hover:border-violet-200 hover:shadow-xl hover:shadow-violet-100/60 transition-all duration-300">

      {/* Thumbnail — hauteur fixe pour homogénéité */}
      <SmartLink internal={isInternalLink} href={href} className="block relative overflow-hidden shrink-0" style={{ height: '176px' }}>
        <img
          src={tutorial.thumbnailUrl ?? '/Yourtuto.jpg'}
          alt={tutorial.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </SmartLink>

      {/* Corps */}
      <div className="p-4 flex flex-col gap-2.5 flex-1">

        {/* Badges */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ring-1 ${cfg.cls}`}>
            {cfg.label}
          </span>
          {(tutorial.categories ?? []).map((cat) => (
            <span key={cat.id} className="text-xs text-zinc-500 bg-zinc-50 ring-1 ring-zinc-200 px-2 py-0.5 rounded-full">
              {cat.name}
            </span>
          ))}
        </div>

        {/* Titre */}
        <SmartLink internal={isInternalLink} href={href} className="block group-hover:text-violet-700 transition-colors duration-200">
          <h2 className="font-semibold text-zinc-900 text-sm leading-snug line-clamp-2">
            {tutorial.title}
          </h2>
        </SmartLink>

        {/* Description */}
        {tutorial.description && (
          <p className="text-xs text-zinc-500 line-clamp-2 leading-relaxed">
            {tutorial.description}
          </p>
        )}

        {/* Difficulté + durée + vues */}
        {(tutorial.difficulty || tutorial.duration || tutorial.viewCount > 0) && (
          <div className="flex items-center gap-2 flex-wrap">
            {tutorial.difficulty && (
              <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ring-1 ${(DIFFICULTY_CONFIG[tutorial.difficulty] ?? DIFFICULTY_FALLBACK).cls}`}>
                {(DIFFICULTY_CONFIG[tutorial.difficulty] ?? DIFFICULTY_FALLBACK).label}
              </span>
            )}
            {tutorial.duration && (
              <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                  <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.3"/>
                  <path d="M6 3.5V6l1.5 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                </svg>
                {tutorial.duration}
              </span>
            )}
            {tutorial.viewCount > 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-zinc-400">
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                  <path d="M1 6s2-4 5-4 5 4 5 4-2 4-5 4-5-4-5-4z" stroke="currentColor" strokeWidth="1.2"/>
                  <circle cx="6" cy="6" r="1.5" stroke="currentColor" strokeWidth="1.2"/>
                </svg>
                {formatViews(tutorial.viewCount)}
              </span>
            )}
          </div>
        )}

        {/* Rating */}
        {rating && rating.count > 0 && (
          <div className="flex items-center gap-1.5">
            <StarRating value={rating.average} readonly size="sm" />
            <span className="text-xs font-semibold text-zinc-700">{rating.average}</span>
            <span className="text-xs text-zinc-400">({rating.count})</span>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-auto pt-3 border-t border-zinc-100">
          {tutorial.author?.username ? (
            <Link
              to={`/users/${tutorial.author.id}`}
              className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
              onClick={e => e.stopPropagation()}
            >
              {tutorial.author.profilePicture ? (
                <img src={`/uploads/avatars/${tutorial.author.profilePicture}`} alt={tutorial.author.username} className="w-5 h-5 rounded-full object-cover" />
              ) : tutorial.author.avatar ? (
                <img src={tutorial.author.avatar} alt={tutorial.author.username} className="w-5 h-5 rounded-full object-cover" />
              ) : (
                <div className="w-5 h-5 rounded-full bg-violet-100 flex items-center justify-center text-violet-600 text-[9px] font-bold shrink-0">
                  {tutorial.author.username.slice(0, 2).toUpperCase()}
                </div>
              )}
              <span className="text-xs text-zinc-400">@{tutorial.author.username}</span>
            </Link>
          ) : (
            <span className="text-xs text-zinc-400">Externe</span>
          )}
          {isInternalLink ? (
            <Link to={href} className="text-xs font-semibold text-violet-600 hover:text-violet-800 flex items-center gap-0.5 transition-colors">
              Lire <span className="text-base leading-none">→</span>
            </Link>
          ) : (
            <a href={href} target="_blank" rel="noopener noreferrer"
              className="text-xs font-semibold text-zinc-400 hover:text-zinc-700 flex items-center gap-0.5 transition-colors">
              Ouvrir <span className="text-base leading-none">↗</span>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
