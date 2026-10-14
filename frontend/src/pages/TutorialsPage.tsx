import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { tutorialsApi } from '../api/tutorials';
import { apiClient } from '../api/client';
import { TutorialCard } from '../components/tutorial/TutorialCard';
import { useAuthStore } from '../store/authStore';
import type { TutorialSource } from '../types';
import { Seo } from '../seo/Seo';
import { DiscoveryFilters } from '../components/tutorial/DiscoveryFilters';

const SOURCES: { value: string; label: string }[] = [
  { value: '',           label: 'Toutes les sources' },
  { value: 'community',  label: 'Communauté' },
  { value: 'youtube',    label: 'YouTube' },
  { value: 'devto',      label: 'DEV.to' },
  { value: 'recipe',     label: '🍳 Recettes' },
  { value: 'generated',  label: '✨ Bricolage' },
  { value: 'dev',        label: '💻 Dev' },
];

export function TutorialsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthenticated } = useAuthStore();

  const search = searchParams.get('search') ?? '';
  const source = searchParams.get('source') ?? '';
  const page   = parseInt(searchParams.get('page') ?? '1', 10);
  const difficulty = searchParams.get('difficulty') ?? '';
  const sort       = searchParams.get('sort') ?? '';

  const [inputValue, setInputValue] = useState(search);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionQuery, setSuggestionQuery] = useState('');
  const searchRef = useRef<HTMLDivElement>(null);

  const setFilter = (updates: Record<string, string>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([k, v]) => {
      if (v) next.set(k, v); else next.delete(k);
    });
    next.delete('page');
    setSearchParams(next);
  };

  // Sync URL → input when navigating back/forward
  useEffect(() => { setInputValue(search); }, [search]);

  // Debounce: update URL 400 ms after the user stops typing
  useEffect(() => {
    const t = setTimeout(() => {
      const trimmed = inputValue.trim();
      if (trimmed !== search) setFilter({ search: trimmed });
    }, 400);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputValue]);

  // Debounce suggestions query separately (200ms)
  useEffect(() => {
    const t = setTimeout(() => setSuggestionQuery(inputValue.trim()), 200);
    return () => clearTimeout(t);
  }, [inputValue]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const externalSources = ['youtube', 'devto', 'reddit', 'medium', 'recipe'];
  const isLiveSearch = !!search && (!source || externalSources.includes(source));

  const isHomeFeed = !search && !source && !difficulty && !sort;

  const { data, isLoading, isFetching, isError } = useQuery({
    queryKey: ['tutorials', { search, source, page, difficulty, sort }],
    queryFn: () => isHomeFeed
      ? tutorialsApi.getDiverseFeed()
      : tutorialsApi.getAll({
          search: search || undefined,
          source: source as TutorialSource || undefined,
          page,
          difficulty: difficulty || undefined,
          order: sort === 'popular' ? { viewCount: 'desc' } : { createdAt: 'desc' },
        }),
    placeholderData: isLiveSearch ? undefined : (prev) => prev,
    staleTime: isLiveSearch ? 0 : isHomeFeed ? 5 * 60 * 1000 : undefined,
  });

  const rawTutorials = useMemo(() => data?.member ?? [], [data]);
  const hasNext = !!data?.view?.next;
  const hasPrev = !!data?.view?.previous;

  // Shuffle when no source filter to mix all content types together
  const tutorials = useMemo(() => {
    if (source || search || difficulty || sort) return rawTutorials;
    // Diverse feed already shuffled server-side, re-shuffle client-side for variety on reload
    return [...rawTutorials].sort(() => Math.random() - 0.5);
  }, [rawTutorials, source, search, difficulty, sort]);

  const { data: recommendations = [] } = useQuery({
    queryKey: ['recommendations'],
    queryFn: () => tutorialsApi.getRecommendations(),
    enabled: isAuthenticated(),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const { data: suggestionsData } = useQuery({
    queryKey: ['suggestions', suggestionQuery],
    queryFn: () => tutorialsApi.getAll({ search: suggestionQuery, page: 1, order: { createdAt: 'desc' } }),
    enabled: suggestionQuery.length >= 2,
    staleTime: 30_000,
  });
  const suggestions = (suggestionsData?.member ?? []).slice(0, 6);

  const allIds = tutorials.map(t => t.id);

  const { data: ratingsMap = {} } = useQuery({
    queryKey: ['tutorial-ratings-batch', allIds],
    queryFn: async () => {
      if (allIds.length === 0) return {};
      const { data } = await apiClient.get<Record<number, { average: number; count: number }>>(
        `/api/tutorial-ratings/batch?ids=${allIds.join(',')}`
      );
      return data;
    },
    enabled: allIds.length > 0,
  });

  return (
    <div className="min-h-screen bg-white">
      <Seo
        title={search ? `Recherche « ${search} »` : 'Tous les tutoriels'}
        description="Parcourez des milliers de tutoriels : développement, IA, bricolage, cuisine et plus encore."
        canonical="/tutorials"
        noindex={!!search || page > 1}
      />

      {/* Hero */}
      <div className="border-b border-zinc-100 bg-gradient-to-b from-violet-50/60 to-white">
        <div className="max-w-4xl mx-auto px-5 py-14 text-center">
          <h1 className="text-4xl font-bold text-zinc-900 mb-3 tracking-tight">
            Explore les tutoriels
          </h1>
          <p className="text-zinc-500 text-lg mb-8">
            Tutoriels de la communauté, YouTube, DEV.to, Reddit et plus encore.
          </p>

          {/* Search */}
          <div className="flex flex-col gap-2 max-w-2xl mx-auto">
            {/* Row 1 on mobile: source select full width. On desktop: hidden (merged into row below) */}
            <select
              value={source}
              onChange={(e) => setFilter({ source: e.target.value })}
              className="sm:hidden w-full bg-white border border-zinc-200 rounded-xl px-3 py-3 text-sm text-zinc-700 shadow-sm focus:outline-none cursor-pointer"
            >
              {SOURCES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>

            {/* Row 2: search input + (select on desktop) */}
            <div className="flex gap-2">
              <div ref={searchRef} className="relative flex-1">
                <div className="flex items-center bg-white border border-zinc-200 rounded-xl shadow-sm focus-within:border-violet-400 focus-within:ring-4 focus-within:ring-violet-500/10 transition-all overflow-hidden">
                  <svg className="ml-4 shrink-0 text-zinc-400" width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M10.5 10.5L13.5 13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  <input
                    type="search"
                    placeholder="Rechercher un tutoriel..."
                    value={inputValue}
                    onChange={(e) => { setInputValue(e.target.value); setShowSuggestions(true); }}
                    onFocus={() => inputValue.length >= 2 && setShowSuggestions(true)}
                    onKeyDown={(e) => e.key === 'Escape' && setShowSuggestions(false)}
                    className="flex-1 px-3 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none bg-transparent"
                  />
                  {inputValue && (
                    <button
                      onClick={() => { setInputValue(''); setFilter({ search: '' }); setShowSuggestions(false); }}
                      className="mr-3 text-zinc-300 hover:text-zinc-500 transition-colors"
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    </button>
                  )}
                </div>

                {/* Suggestions dropdown */}
                {showSuggestions && suggestions.length > 0 && (
                  <ul className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-zinc-200 rounded-xl shadow-lg z-50 overflow-hidden">
                    {suggestions.map((t) => {
                      const src = SOURCES.find(s => s.value === t.source)?.label ?? t.source;
                      return (
                        <li key={t.id}>
                          <button
                            onMouseDown={(e) => {
                              e.preventDefault(); // prevent input blur
                              setInputValue(t.title);
                              setFilter({ search: t.title });
                              setShowSuggestions(false);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-violet-50 transition-colors"
                          >
                            <svg className="shrink-0 text-zinc-300" width="14" height="14" viewBox="0 0 16 16" fill="none">
                              <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.5"/>
                              <path d="M10.5 10.5L13.5 13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                            </svg>
                            <span className="flex-1 text-sm text-zinc-800 truncate">{t.title}</span>
                            <span className="text-xs text-zinc-400 shrink-0">{src}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <select
                value={source}
                onChange={(e) => setFilter({ source: e.target.value })}
                className="hidden sm:block bg-white border border-zinc-200 rounded-xl px-3 py-3 text-sm text-zinc-700 shadow-sm focus:outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-500/10 transition-all cursor-pointer"
              >
                {SOURCES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-5 py-8">

        <DiscoveryFilters difficulty={difficulty} sort={sort} onChange={setFilter} disabled={isLiveSearch} />

        {/* Stats + filtres actifs */}
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          {!isLoading && tutorials.length > 0 && (
            <span className="text-sm text-zinc-400">
              Page {page}
            </span>
          )}
          {search && (
            <span className="inline-flex items-center gap-1.5 bg-violet-50 text-violet-700 ring-1 ring-violet-600/20 px-2.5 py-1 rounded-full text-xs font-medium">
              "{search}"
              <button onClick={() => { setInputValue(''); setFilter({ search: '' }); }} className="hover:text-violet-900 leading-none">×</button>
            </span>
          )}
          {source && (
            <span className="inline-flex items-center gap-1.5 bg-zinc-100 text-zinc-600 ring-1 ring-zinc-200 px-2.5 py-1 rounded-full text-xs">
              {SOURCES.find(s => s.value === source)?.label}
              <button onClick={() => setFilter({ source: '' })} className="hover:text-zinc-900 leading-none">×</button>
            </span>
          )}
        </div>

        {/* Recommendations */}
        {recommendations.length > 0 && !source && !search && (
          <div className="mb-10">
            <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-widest mb-4">✨ Pour toi</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              {recommendations.map((t) => (
                <TutorialCard key={t.id} tutorial={t} />
              ))}
            </div>
            <div className="mt-6 border-t border-zinc-100" />
          </div>
        )}

        {/* States */}
        {(isLoading || isFetching) && (
          <div className="flex flex-col items-center gap-3 mt-24">
            <div className="w-8 h-8 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-zinc-400">Chargement...</span>
          </div>
        )}

        {isError && (
          <p className="text-center text-red-500 mt-10 text-sm">Une erreur est survenue lors du chargement.</p>
        )}

        {!isLoading && !isError && tutorials.length === 0 && (
          <div className="text-center mt-24">
            <div className="w-16 h-16 rounded-3xl bg-zinc-50 border border-zinc-200 flex items-center justify-center mx-auto mb-5">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-zinc-300">
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M16.5 16.5L21 21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <p className="font-semibold text-zinc-900 mb-1.5">Aucun résultat</p>
            <p className="text-sm text-zinc-400">
              {search || source ? "Essaie d'autres termes ou supprime les filtres." : "Aucun tutoriel disponible pour l'instant."}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 max-w-md sm:max-w-none mx-auto">
          {tutorials.map((t) => (
            <TutorialCard
              key={t.id}
              tutorial={t}
              rating={ratingsMap[t.id]}
            />
          ))}
        </div>

        {/* Pagination */}
        {(hasPrev || hasNext) && (
          <div className="flex justify-center items-center gap-2 mt-12">
            <button
              onClick={() => setSearchParams(p => { const n = new URLSearchParams(p); n.set('page', String(page - 1)); return n; })}
              disabled={!hasPrev}
              className="px-4 py-2 rounded-xl border border-zinc-200 bg-white text-sm text-zinc-600 hover:border-zinc-300 hover:text-zinc-900 disabled:opacity-40 transition-all shadow-sm"
            >
              ← Précédent
            </button>
            <span className="px-4 py-2 text-sm text-zinc-400">Page {page}</span>
            <button
              onClick={() => setSearchParams(p => { const n = new URLSearchParams(p); n.set('page', String(page + 1)); return n; })}
              disabled={!hasNext}
              className="px-4 py-2 rounded-xl border border-zinc-200 bg-white text-sm text-zinc-600 hover:border-zinc-300 hover:text-zinc-900 disabled:opacity-40 transition-all shadow-sm"
            >
              Suivant →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
