import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { tutorialsApi } from '../api/tutorials';
import { TutorialCard } from '../components/tutorial/TutorialCard';
import { apiClient } from '../api/client';
import type { TutorialSource } from '../types';
import { Seo } from '../seo/Seo';
import { absoluteUrl } from '../seo/url';

// ── Config par source ─────────────────────────────────────────────────────────

const DOMAIN_CONFIG: Record<string, {
  label: string;
  desc: string;
  photo: string;
  icon: string;
}> = {
  dev:       {
    label: 'Développement',
    desc:  'Code, frameworks, outils et tutoriels techniques',
    photo: '1461749280684-dccba630e2f6',
    icon:  'code-simple-bold',
  },
  recipe:    {
    label: 'Cuisine',
    desc:  'Recettes, techniques culinaires et idées repas',
    photo: '1556909114-f6e7ad7d3136',
    icon:  'cooking-pot-fill',
  },
  generated: {
    label: 'Bricolage',
    desc:  'DIY, réparations, projets et tutoriels manuels',
    photo: '1581578731548-c64695cc6952',
    icon:  'hammer-fill',
  },
  community: {
    label: 'Communauté',
    desc:  'Tutoriels partagés par la communauté YourTuto',
    photo: '1529156069898-49953e39b3ac',
    icon:  'users-three-fill',
  },
  youtube:   {
    label: 'YouTube',
    desc:  'Les meilleures vidéos éducatives sélectionnées',
    photo: '1611162617474-5b21e879e113',
    icon:  'youtube-logo-fill',
  },
  devto:     {
    label: 'DEV.to & Reddit',
    desc:  'Articles et discussions tech de la communauté dev',
    photo: '1498050108023-c5249f4df085',
    icon:  'newspaper-fill',
  },
};

type SortTab = 'recent' | 'trending';

// ── Grain overlay ─────────────────────────────────────────────────────────────

const GrainOverlay = () => (
  <div
    className="pointer-events-none absolute inset-0 z-0 opacity-[0.025]"
    style={{
      backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
      backgroundRepeat: 'repeat',
      backgroundSize: '128px 128px',
    }}
  />
);

// ── Page ──────────────────────────────────────────────────────────────────────

export function CategoryPage() {
  const { source = '' } = useParams<{ source: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const page        = parseInt(searchParams.get('page') ?? '1', 10);
  const searchQuery = searchParams.get('search') ?? '';
  const sort        = (searchParams.get('sort') ?? 'recent') as SortTab;

  const [inputValue, setInputValue]       = useState(searchQuery);
  const [searchFocused, setSearchFocused] = useState(false);
  const [showSugg, setShowSugg]           = useState(false);
  const [suggQuery, setSuggQuery]         = useState('');
  const searchRef = useRef<HTMLDivElement>(null);

  const cfg = DOMAIN_CONFIG[source];

  // Sync URL → input
  useEffect(() => { setInputValue(searchQuery); }, [searchQuery]);

  // Debounce search → URL
  useEffect(() => {
    const t = setTimeout(() => {
      const trimmed = inputValue.trim();
      if (trimmed !== searchQuery) {
        const next = new URLSearchParams(searchParams);
        if (trimmed) next.set('search', trimmed); else next.delete('search');
        next.delete('page');
        setSearchParams(next);
      }
    }, 400);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputValue]);

  // Debounce suggestions (200ms)
  useEffect(() => {
    const t = setTimeout(() => setSuggQuery(inputValue.trim()), 200);
    return () => clearTimeout(t);
  }, [inputValue]);

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node))
        setShowSugg(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const setSort = (s: SortTab) => {
    const next = new URLSearchParams(searchParams);
    next.set('sort', s);
    next.delete('page');
    setSearchParams(next);
  };

  const setPage = (p: number) => {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(p));
    setSearchParams(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ── Main query ──────────────────────────────────────────────────────────────
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['category', source, searchQuery, sort, page],
    queryFn: () => tutorialsApi.getAll({
      source:  source as TutorialSource,
      search:  searchQuery || undefined,
      page,
      order:   sort === 'trending' ? { viewCount: 'desc' } : { createdAt: 'desc' },
    }),
    placeholderData: (prev) => prev,
    staleTime: 2 * 60 * 1000,
  });

  const tutorials = data?.member ?? [];
  const hasNext   = !!data?.view?.next;
  const hasPrev   = !!data?.view?.previous;
  const total     = data?.totalItems ?? 0;

  // ── Ratings batch ───────────────────────────────────────────────────────────
  const allIds = tutorials.map(t => t.id);
  const { data: ratingsMap = {} } = useQuery({
    queryKey: ['ratings-batch-category', allIds],
    queryFn: async () => {
      if (!allIds.length) return {};
      const { data } = await apiClient.get<Record<number, { average: number; count: number }>>(
        `/api/tutorial-ratings/batch?ids=${allIds.join(',')}`
      );
      return data;
    },
    enabled: allIds.length > 0,
  });

  // ── Suggestions ─────────────────────────────────────────────────────────────
  const { data: suggData } = useQuery({
    queryKey: ['category-suggestions', source, suggQuery],
    queryFn: () => tutorialsApi.getAll({ source: source as TutorialSource, search: suggQuery, page: 1, order: { createdAt: 'desc' } }),
    enabled: suggQuery.length >= 2,
    staleTime: 30_000,
  });
  const suggestions = (suggData?.member ?? []).slice(0, 5);

  // ── 404 si source inconnue ──────────────────────────────────────────────────
  if (!cfg) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0D0D14' }}>
        <Seo title="Catégorie introuvable" description="Cette catégorie n'existe pas." canonical={`/category/${source}`} noindex />
        <div className="text-center">
          <p style={{ fontFamily: 'Sora, sans-serif', fontSize: '48px', fontWeight: 800, color: '#E8E8F2' }}>404</p>
          <p style={{ fontFamily: 'Inter, sans-serif', color: '#4A4A66', marginTop: '8px' }}>Catégorie inconnue</p>
          <Link to="/" className="ni-btn-primary" style={{ marginTop: '24px', padding: '10px 20px', fontSize: '14px', display: 'inline-flex' }}>
            ← Retour à l'accueil
          </Link>
        </div>
      </div>
    );
  }

  const photoUrl = `https://images.unsplash.com/photo-${cfg.photo}?w=1600&h=500&fit=crop&q=80&auto=format`;

  return (
    <div className="min-h-screen" style={{ background: '#F8F8FF', color: '#09090b' }}>
      <Seo
        title={`Tutoriels ${cfg.label}`}
        description={`${cfg.desc} : sélection YourTuto.`}
        canonical={`/category/${source}`}
        image={photoUrl}
        jsonLd={[
          { '@context': 'https://schema.org', '@type': 'CollectionPage', name: cfg.label, description: cfg.desc, url: absoluteUrl(`/category/${source}`) },
          {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'YourTuto', item: absoluteUrl('/') },
              { '@type': 'ListItem', position: 2, name: cfg.label, item: absoluteUrl(`/category/${source}`) },
            ],
          },
        ]}
      />

      {/* ── HERO ────────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden" style={{ minHeight: '320px' }}>
        <GrainOverlay />

        {/* Photo de fond */}
        <img
          src={photoUrl}
          alt=""
          aria-hidden="true"
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'cover',
            objectPosition: 'center',
          }}
        />

        {/* Overlay léger en haut, fondu vers blanc en bas */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(180deg, rgba(13,13,20,0.45) 0%, rgba(13,13,20,0.6) 55%, rgba(248,248,255,1) 100%)',
        }} />

        <div className="relative z-10 max-w-6xl mx-auto px-6 pt-10 pb-16">

          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 mb-8" aria-label="breadcrumb">
            <Link
              to="/"
              style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: 'rgba(255,255,255,0.45)', textDecoration: 'none', transition: 'color 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.8)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.45)')}
            >
              Accueil
            </Link>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ color: 'rgba(255,255,255,0.25)', flexShrink: 0 }}>
              <path d="M4.5 2.5L7.5 6l-3 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>
              {cfg.label}
            </span>
          </nav>

          <div className="flex flex-col lg:flex-row lg:items-end gap-8 justify-between">
            {/* Titre */}
            <div>
              {/* Icône */}
              <div style={{
                width: '52px', height: '52px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(13,13,20,0.6)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '14px',
                marginBottom: '16px',
              }}>
                <img
                  src={`https://api.iconify.design/ph/${cfg.icon}.svg?color=%23ffffff&width=26&height=26`}
                  alt=""
                  width="26"
                  height="26"
                />
              </div>

              <h1 style={{
                fontFamily: 'Sora, sans-serif',
                fontWeight: 800,
                fontSize: 'clamp(36px, 5vw, 60px)',
                letterSpacing: '-0.02em',
                lineHeight: 1.05,
                color: '#ffffff',
                marginBottom: '10px',
                textShadow: '0 2px 20px rgba(0,0,0,0.5)',
              }}>
                {cfg.label}
              </h1>
              <p style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: '15px',
                color: 'rgba(255,255,255,0.55)',
                maxWidth: '480px',
                lineHeight: 1.6,
              }}>
                {cfg.desc}
              </p>

              {total > 0 && (
                <p style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '13px',
                  color: 'rgba(255,255,255,0.35)',
                  marginTop: '10px',
                }}>
                  {total.toLocaleString('fr-FR')} tutoriel{total > 1 ? 's' : ''}
                </p>
              )}
            </div>

            {/* Search + sort */}
            <div style={{ width: '100%', maxWidth: '480px' }}>

              {/* Barre de recherche — frosted glass blanc */}
              <div ref={searchRef} style={{ position: 'relative', marginBottom: '12px' }}>
                <div style={{
                  background: 'rgba(255,255,255,0.22)',
                  backdropFilter: 'blur(20px)',
                  border: `1px solid ${searchFocused ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.35)'}`,
                  borderRadius: '14px',
                  boxShadow: searchFocused
                    ? '0 0 0 3px rgba(255,255,255,0.15), 0 8px 32px rgba(0,0,0,0.15)'
                    : '0 4px 16px rgba(0,0,0,0.15)',
                  transition: 'border-color 0.25s, box-shadow 0.25s',
                }}>
                  <div className="flex items-center" style={{ padding: '0 16px', gap: '12px' }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
                      style={{ flexShrink: 0, color: searchFocused ? '#ffffff' : 'rgba(255,255,255,0.65)', transition: 'color 0.25s' }}>
                      <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.5"/>
                      <path d="M10.5 10.5L13.5 13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                    <input
                      type="search"
                      value={inputValue}
                      onChange={e => { setInputValue(e.target.value); setShowSugg(true); }}
                      onFocus={() => { setSearchFocused(true); if (inputValue.length >= 2) setShowSugg(true); }}
                      onBlur={() => setSearchFocused(false)}
                      onKeyDown={e => e.key === 'Escape' && setShowSugg(false)}
                      placeholder={`Rechercher dans ${cfg.label}…`}
                      style={{
                        flex: 1, padding: '16px 0',
                        background: 'transparent', border: 'none', outline: 'none',
                        fontFamily: 'Inter, sans-serif', fontSize: '14px',
                        color: '#ffffff',
                        caretColor: '#ffffff',
                      }}
                    />
                    {inputValue && (
                      <button
                        onClick={() => { setInputValue(''); const next = new URLSearchParams(searchParams); next.delete('search'); next.delete('page'); setSearchParams(next); setShowSugg(false); }}
                        style={{ color: 'rgba(255,255,255,0.5)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px', transition: 'color 0.2s' }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#ffffff')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}
                      >
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* Suggestions */}
                {showSugg && suggestions.length > 0 && (
                  <ul style={{
                    position: 'absolute', left: 0, right: 0, top: 'calc(100% + 6px)',
                    background: '#12121E',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '12px',
                    boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
                    zIndex: 50,
                    overflow: 'hidden',
                    listStyle: 'none',
                    margin: 0, padding: '4px',
                  }}>
                    {suggestions.map(t => (
                      <li key={t.id}>
                        <button
                          onMouseDown={e => {
                            e.preventDefault();
                            setInputValue(t.title);
                            const next = new URLSearchParams(searchParams);
                            next.set('search', t.title);
                            next.delete('page');
                            setSearchParams(next);
                            setShowSugg(false);
                          }}
                          style={{
                            width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                            padding: '10px 12px', background: 'none', border: 'none',
                            cursor: 'pointer', borderRadius: '8px',
                            textAlign: 'left', transition: 'background 0.15s',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(124,58,237,0.08)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                        >
                          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ color: '#4A4A66', flexShrink: 0 }}>
                            <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.5"/>
                            <path d="M10.5 10.5L13.5 13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                          </svg>
                          <span style={{ flex: 1, fontFamily: 'Inter, sans-serif', fontSize: '13px', color: '#C0C0D8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {t.title}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Filtre actif */}
              {searchQuery && (
                <div className="flex items-center gap-2 mt-3">
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>Résultats pour :</span>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    background: 'rgba(255,255,255,0.2)',
                    border: '1px solid rgba(255,255,255,0.35)',
                    color: '#ffffff',
                    padding: '3px 10px', borderRadius: '20px',
                    fontFamily: 'Inter, sans-serif', fontSize: '12px', fontWeight: 500,
                    backdropFilter: 'blur(8px)',
                  }}>
                    "{searchQuery}"
                    <button
                      onClick={() => { setInputValue(''); const next = new URLSearchParams(searchParams); next.delete('search'); next.delete('page'); setSearchParams(next); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.7)', lineHeight: 1, padding: 0, fontSize: '14px' }}
                    >×</button>
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── CONTENU — fond clair, cards blanches cohérentes ─────────────────── */}
      <div className="max-w-7xl mx-auto px-6 py-10">

        {/* Tabs tri + compteur */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div style={{
            display: 'inline-flex',
            background: '#ffffff',
            border: '1px solid #e4e4e7',
            borderRadius: '10px',
            padding: '4px',
            gap: '2px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          }}>
            {(['recent', 'trending'] as SortTab[]).map(tab => (
              <button
                key={tab}
                onClick={() => setSort(tab)}
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '13px',
                  fontWeight: 500,
                  padding: '8px 18px',
                  background: sort === tab ? '#7C3AED' : 'transparent',
                  color: sort === tab ? '#ffffff' : '#71717a',
                  border: 'none',
                  cursor: 'pointer',
                  borderRadius: '7px',
                  transition: 'all 0.18s',
                  boxShadow: sort === tab ? '0 2px 8px rgba(124,58,237,0.3)' : 'none',
                }}
              >
                {tab === 'recent' ? '✦ Récents' : '↑ Tendances'}
              </button>
            ))}
          </div>

          {!isLoading && total > 0 && (
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: '#a1a1aa' }}>
              Page {page} · {total.toLocaleString('fr-FR')} résultat{total > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Loading */}
        {(isLoading || isFetching) && (
          <div className="flex flex-col items-center gap-3 py-24">
            <div style={{ width: '36px', height: '36px', border: '2px solid #7C3AED', borderTopColor: 'transparent', borderRadius: '50%' }} className="animate-spin" />
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: '#a1a1aa' }}>Chargement…</span>
          </div>
        )}

        {/* Vide */}
        {!isLoading && !isFetching && tutorials.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-24">
            <div style={{
              width: '64px', height: '64px', borderRadius: '16px',
              background: '#f4f4f5', border: '1px solid #e4e4e7',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" style={{ color: '#d4d4d8' }}>
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M16.5 16.5L21 21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <p style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '18px', color: '#09090b' }}>Aucun résultat</p>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', color: '#71717a' }}>
              {searchQuery ? 'Essaie d\'autres mots-clés.' : 'Aucun contenu disponible dans cette catégorie pour l\'instant.'}
            </p>
            {searchQuery && (
              <button
                onClick={() => { setInputValue(''); const next = new URLSearchParams(searchParams); next.delete('search'); next.delete('page'); setSearchParams(next); }}
                className="ni-btn-primary"
                style={{ fontSize: '13px', padding: '9px 18px', marginTop: '4px' }}
              >
                Effacer la recherche
              </button>
            )}
          </div>
        )}

        {/* Grille de cartes */}
        {!isLoading && tutorials.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 animate-fade-in">
            {tutorials.map((t, i) => (
              <div key={t.id} className="animate-slide-up" style={{ animationDelay: `${i * 40}ms`, animationFillMode: 'both' }}>
                <TutorialCard tutorial={t} rating={ratingsMap[t.id]} />
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {!isLoading && (hasPrev || hasNext) && (
          <div className="flex justify-center items-center gap-3 mt-14">
            <button
              onClick={() => setPage(page - 1)}
              disabled={!hasPrev}
              className="px-5 py-2.5 rounded-xl border text-sm font-medium transition-all disabled:opacity-40"
              style={{
                background: '#ffffff', border: '1px solid #e4e4e7',
                color: '#71717a', cursor: hasPrev ? 'pointer' : 'not-allowed',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              }}
              onMouseEnter={e => { if (hasPrev) { e.currentTarget.style.borderColor = '#7C3AED'; e.currentTarget.style.color = '#7C3AED'; } }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#e4e4e7'; e.currentTarget.style.color = '#71717a'; }}
            >
              ← Précédent
            </button>

            <span style={{
              fontFamily: 'Inter, sans-serif', fontSize: '13px',
              color: '#7C3AED', fontWeight: 600,
              padding: '10px 20px',
              background: '#f5f3ff',
              border: '1px solid #ede9fe',
              borderRadius: '10px',
            }}>
              Page {page}
            </span>

            <button
              onClick={() => setPage(page + 1)}
              disabled={!hasNext}
              className="px-5 py-2.5 rounded-xl border text-sm font-medium transition-all disabled:opacity-40"
              style={{
                background: '#ffffff', border: '1px solid #e4e4e7',
                color: '#71717a', cursor: hasNext ? 'pointer' : 'not-allowed',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              }}
              onMouseEnter={e => { if (hasNext) { e.currentTarget.style.borderColor = '#7C3AED'; e.currentTarget.style.color = '#7C3AED'; } }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#e4e4e7'; e.currentTarget.style.color = '#71717a'; }}
            >
              Suivant →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
