import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useProgress, useToggleProgress, useToggleDone } from '../hooks/useProgress';
import { apiClient } from '../api/client';
import type { ProgressItem } from '../api/progress';
import { ActivityHeatmap, type HeatmapDay } from '../components/stats/ActivityHeatmap';

const SOURCE_LABEL: Record<string, string> = {
  community:     'Communauté',
  youtube:       'YouTube',
  devto:         'DEV.to',
  reddit:        'Reddit',
  medium:        'Medium',
  recipe:        '🍳 Recette',
  instructables: '🔧 DIY',
  generated:     '✨ Bricolage',
  dev:           '💻 Dev',
};

const SOURCE_COLOR: Record<string, string> = {
  community:     'bg-emerald-100 text-emerald-700',
  youtube:       'bg-red-100 text-red-600',
  devto:         'bg-violet-100 text-violet-700',
  reddit:        'bg-orange-100 text-orange-600',
  medium:        'bg-sky-100 text-sky-700',
  recipe:        'bg-amber-100 text-amber-700',
  instructables: 'bg-lime-100 text-lime-700',
  generated:     'bg-purple-100 text-purple-700',
  dev:           'bg-indigo-100 text-indigo-700',
};

const SOURCE_ICON: Record<string, string> = {
  community: '🌐', youtube: '▶️', devto: '📝', reddit: '💬',
  medium: '✍️', recipe: '🍳', instructables: '🔧', generated: '✨', dev: '💻',
};

function itemLink(item: ProgressItem): string {
  const slug = item.itemSlug;
  if (item.source === 'community' || item.source === 'generated' || item.source === 'dev') return `/tutorials/${slug}`;
  if (item.source === 'devto')   return `/devto/${slug}`;
  if (item.source === 'reddit')  return `/reddit/${slug.replace('reddit-', '')}`;
  if (item.source === 'youtube') return `/youtube/${slug}`;
  if (item.source === 'recipe') {
    if (slug.startsWith('spoonacular-')) return item.externalUrl ?? '#';
    if (slug.startsWith('mealdb-')) return `/recipe/${slug.replace('mealdb-', '')}`;
    return `/tutorials/${slug}`; // slug is the tutorial DB id
  }
  return item.externalUrl ?? '#';
}

function getInteractiveProgress(item: ProgressItem): { step: number; total: number } | null {
  if (item.source !== 'recipe' && item.source !== 'generated') return null;
  try {
    const raw = localStorage.getItem(`ytuto_step_${item.itemSlug}_${item.source}`);
    if (!raw) return null;
    const { step, total } = JSON.parse(raw) as { step: number; total: number };
    if (typeof step === 'number' && typeof total === 'number' && total > 0) return { step, total };
  } catch { /* ignore */ }
  return null;
}

function isExternal(item: ProgressItem): boolean {
  if (['community', 'devto', 'reddit', 'generated', 'dev', 'youtube'].includes(item.source)) return false;
  if (item.source === 'recipe' && !item.itemSlug.startsWith('spoonacular-')) return false;
  return true;
}

interface Stats {
  total: number;
  streak: number;
  longestStreak?: number;
  activeToday?: boolean;
  last7Days?: number;
  last30Days?: number;
  heatmap?: HeatmapDay[];
  badges: { id: string; label: string; icon: string }[];
}

type Filter = 'all' | 'ongoing' | 'done';

function CircleProgress({ value, size = 72 }: { value: number; size?: number }) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (value / 100) * circ;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="6" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="white" strokeWidth="6"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease' }} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white">
        {value}%
      </span>
    </div>
  );
}

export function MyProgressPage() {
  const { data: items = [], isLoading } = useProgress();
  const toggle     = useToggleProgress();
  const toggleDone = useToggleDone();
  const [filter, setFilter] = useState<Filter>('all');

  const { data: stats } = useQuery<Stats>({
    queryKey: ['progress-stats'],
    queryFn: async () => {
      const { data } = await apiClient.get<Stats>('/api/progress/stats');
      return data;
    },
  });

  const doneCount       = items.filter(i => i.isDone).length;
  const inProgressCount = items.filter(i => !i.isDone).length;
  const completionRate  = items.length > 0 ? Math.round((doneCount / items.length) * 100) : 0;

  const filtered = items.filter(item => {
    if (filter === 'done')    return item.isDone;
    if (filter === 'ongoing') return !item.isDone;
    return true;
  });

  const handleRemove = (item: ProgressItem) => {
    toggle.mutate({ slug: item.itemSlug, source: item.source, title: item.title });
  };

  const TABS: { key: Filter; label: string; count: number }[] = [
    { key: 'all',     label: 'Tout',      count: items.length },
    { key: 'ongoing', label: 'En cours',  count: inProgressCount },
    { key: 'done',    label: 'Terminés',  count: doneCount },
  ];

  return (
    <div className="min-h-screen bg-zinc-50">

      {/* ── Hero ────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-violet-600 via-purple-700 to-indigo-800 text-white">
        <div className="max-w-4xl mx-auto px-5 pt-10 pb-20">
          <p className="text-violet-300 text-xs font-semibold uppercase tracking-widest mb-1">Tableau de bord</p>
          <h1 className="text-3xl font-bold mb-8">Mon parcours</h1>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Completion ring */}
            <div className="col-span-2 sm:col-span-1 bg-white/10 backdrop-blur-sm rounded-2xl px-4 py-4 flex items-center gap-4">
              <CircleProgress value={completionRate} />
              <div>
                <p className="text-xs text-violet-200 mb-0.5">Complétion</p>
                <p className="text-xl font-bold leading-none">{doneCount}<span className="text-violet-300 font-normal text-sm">/{items.length}</span></p>
              </div>
            </div>

            {/* Streak */}
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl px-4 py-4">
              <div className="text-2xl mb-1.5">🔥</div>
              <p className="text-2xl font-bold leading-none">{stats?.streak ?? 0}</p>
              <p className="text-xs text-violet-200 mt-1">jours de suite</p>
              {stats?.longestStreak ? <p className="text-[11px] text-violet-300 mt-0.5">record : {stats.longestStreak} j</p> : null}
            </div>

            {/* En cours */}
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl px-4 py-4">
              <div className="text-2xl mb-1.5">📖</div>
              <p className="text-2xl font-bold leading-none">{inProgressCount}</p>
              <p className="text-xs text-violet-200 mt-1">en cours</p>
            </div>

            {/* Terminés */}
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl px-4 py-4">
              <div className="text-2xl mb-1.5">🏆</div>
              <p className="text-2xl font-bold leading-none">{doneCount}</p>
              <p className="text-xs text-violet-200 mt-1">terminés</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto px-5 -mt-8">

        {/* Badges */}
        {stats && stats.badges.length > 0 && (
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm px-5 py-4 mb-4 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mr-1">Badges</span>
            {stats.badges.map(badge => (
              <div key={badge.id}
                className="flex items-center gap-1.5 bg-violet-50 border border-violet-100 rounded-xl px-3 py-1.5 text-sm font-medium text-violet-700">
                <span>{badge.icon}</span>
                {badge.label}
              </div>
            ))}
          </div>
        )}

        {/* Activity */}
        {stats?.heatmap && (
          <section className="bg-white rounded-2xl border border-zinc-200 shadow-sm px-5 py-4 mb-4" aria-labelledby="activity-title">
            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
              <h2 id="activity-title" className="text-sm font-semibold text-zinc-700">Activité</h2>
              <p className="text-xs text-zinc-500">
                {stats.last7Days ?? 0} cette semaine · {stats.last30Days ?? 0} ce mois
                {stats.streak > 0 && !stats.activeToday && <span className="ml-2 text-amber-600 font-medium">Termine un tuto aujourd'hui pour garder ta série 🔥</span>}
              </p>
            </div>
            <ActivityHeatmap days={stats.heatmap} />
          </section>
        )}

        {/* Filter tabs */}
        {!isLoading && items.length > 0 && (
          <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm p-1 mb-4 flex w-fit gap-1">
            {TABS.map(tab => (
              <button key={tab.key} onClick={() => setFilter(tab.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  filter === tab.key
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50'
                }`}>
                {tab.label}
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                  filter === tab.key ? 'bg-white/25 text-white' : 'bg-zinc-100 text-zinc-500'
                }`}>{tab.count}</span>
              </button>
            ))}
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex justify-center py-24">
            <div className="w-6 h-6 rounded-full border-2 border-violet-600 border-t-transparent animate-spin" />
          </div>
        )}

        {/* Empty — liste vide */}
        {!isLoading && items.length === 0 && (
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm text-center py-20 px-8">
            <div className="text-5xl mb-4">📚</div>
            <p className="text-zinc-800 font-semibold text-lg mb-1">Ton parcours est vide</p>
            <p className="text-zinc-400 text-sm mb-7 max-w-xs mx-auto">
              Explore des tutoriels, recettes ou bricolages et marque-les pour les retrouver ici.
            </p>
            <Link to="/"
              className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors">
              Explorer les tutoriels →
            </Link>
          </div>
        )}

        {/* Empty — filtre vide */}
        {!isLoading && items.length > 0 && filtered.length === 0 && (
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm text-center py-12 text-zinc-400 text-sm">
            Aucun élément dans cette catégorie.
          </div>
        )}

        {/* List */}
        {!isLoading && filtered.length > 0 && (
          <ul className="flex flex-col gap-3 pb-12">
            {filtered.map((item, idx) => {
              const href  = itemLink(item);
              const ext   = isExternal(item);
              const color = SOURCE_COLOR[item.source] ?? 'bg-zinc-100 text-zinc-600';
              const label = SOURCE_LABEL[item.source] ?? item.source;
              const icon  = SOURCE_ICON[item.source] ?? '📄';
              const date  = new Date(item.completedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
              const interactiveProgress = getInteractiveProgress(item);
              const pct = interactiveProgress
                ? Math.round(((interactiveProgress.step + 1) / interactiveProgress.total) * 100)
                : 0;

              return (
                <li key={item.id}
                  className="animate-slide-up bg-white rounded-2xl border border-zinc-200 hover:border-violet-200 hover:shadow-sm transition-all overflow-hidden"
                  style={{ animationDelay: `${idx * 35}ms` }}>

                  <div className="flex gap-4 p-4">
                    {/* Thumbnail */}
                    {item.thumbnailUrl ? (
                      <img src={item.thumbnailUrl} alt={item.title}
                        className="w-20 h-16 object-cover rounded-xl shrink-0" />
                    ) : (
                      <div className="w-20 h-16 rounded-xl bg-gradient-to-br from-zinc-100 to-zinc-50 border border-zinc-100 shrink-0 flex items-center justify-center text-2xl">
                        {icon}
                      </div>
                    )}

                    {/* Body */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${color}`}>
                          {label}
                        </span>
                        <span className="text-xs text-zinc-400">{date}</span>
                        {item.isDone && (
                          <span className="ml-auto flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
                            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            Terminé
                          </span>
                        )}
                      </div>
                      {ext ? (
                        <a href={href} target="_blank" rel="noopener noreferrer"
                          className="font-semibold text-zinc-900 hover:text-violet-700 line-clamp-2 leading-snug transition-colors text-sm">
                          {item.title}
                        </a>
                      ) : (
                        <Link to={href}
                          className="font-semibold text-zinc-900 hover:text-violet-700 line-clamp-2 leading-snug transition-colors text-sm">
                          {item.title}
                        </Link>
                      )}
                    </div>

                    {/* Remove */}
                    <button onClick={() => handleRemove(item)} disabled={toggle.isPending}
                      title="Retirer de la liste"
                      className="w-7 h-7 shrink-0 self-start rounded-full flex items-center justify-center text-zinc-300 hover:text-red-400 hover:bg-red-50 transition-all">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2 2l8 8M10 2L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    </button>
                  </div>

                  {/* Interactive progress bar */}
                  {interactiveProgress && !item.isDone && (
                    <div className="px-4 pb-3 -mt-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-zinc-400">
                          Mode interactif · étape {interactiveProgress.step + 1}/{interactiveProgress.total}
                        </span>
                        <span className="text-xs font-bold text-violet-600">{pct}%</span>
                      </div>
                      <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-purple-500 transition-all"
                          style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )}

                  {/* Footer */}
                  <div className="border-t border-zinc-100 px-4 py-2.5 flex items-center gap-3 bg-zinc-50/50">
                    <button onClick={() => toggleDone.mutate(item.id)} disabled={toggleDone.isPending}
                      className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${
                        item.isDone
                          ? 'border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100'
                          : 'border-zinc-200 bg-white text-zinc-500 hover:border-violet-300 hover:text-violet-600 hover:bg-violet-50'
                      }`}>
                      <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      {item.isDone ? 'Marquer non terminé' : 'Marquer comme terminé'}
                    </button>
                    {!ext && (
                      <Link to={href}
                        className="ml-auto text-xs text-zinc-400 hover:text-violet-600 font-medium transition-colors">
                        Voir →
                      </Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
