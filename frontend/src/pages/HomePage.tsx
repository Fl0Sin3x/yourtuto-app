import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { tutorialsApi } from '../api/tutorials';
import { TutorialCard } from '../components/tutorial/TutorialCard';
import { useAuthStore } from '../store/authStore';
import { apiClient } from '../api/client';
import { statsApi } from '../api/stats';
import { useProgress } from '../hooks/useProgress';
import { Seo } from '../seo/Seo';
import { absoluteUrl } from '../seo/url';

// ── Config ────────────────────────────────────────────────────────────────────

// Photos Unsplash libres de droits (licence Unsplash), ID stable
const DOMAIN_PHOTOS: Record<string, string> = {
  '':          'photo-1543269865-cbf427effbad', // bibliothèque / apprentissage
  'dev':       'photo-1461749280684-dccba630e2f6', // code sur écran
  'recipe':    'photo-1556909114-f6e7ad7d3136', // cuisine / wok
  'generated': 'photo-1581578731548-c64695cc6952', // atelier / réparation
  'community': 'photo-1529156069898-49953e39b3ac', // groupe de personnes
  'youtube':   'photo-1611162617474-5b21e879e113', // YouTube sur laptop
  'devto':     'photo-1498050108023-c5249f4df085', // laptop / article tech
};

const unsplash = (source: string) =>
  `https://images.unsplash.com/${DOMAIN_PHOTOS[source]}?w=480&h=320&fit=crop&q=75&auto=format`;

const DOMAINS = [
  { label: 'Tout',            emoji: '✦', source: '',          desc: 'Tous les domaines'            },
  { label: 'Développement',   emoji: '⌥', source: 'dev',       desc: 'Code, frameworks, outils'     },
  { label: 'Cuisine',         emoji: '◈', source: 'recipe',    desc: 'Recettes & techniques'         },
  { label: 'Bricolage',       emoji: '⚙', source: 'generated', desc: 'DIY, réparations, projets'    },
  { label: 'Communauté',      emoji: '◉', source: 'community', desc: 'Tutos partagés'                },
  { label: 'YouTube',         emoji: '▶', source: 'youtube',   desc: 'Vidéos sélectionnées'          },
  { label: 'DEV.to & Reddit', emoji: '⊞', source: 'devto',     desc: 'Articles & discussions tech'  },
];

const PH = (name: string, size = 22) => (
  <img
    src={`https://api.iconify.design/ph/${name}.svg?color=%237c3aed&width=${size}&height=${size}`}
    alt=""
    width={size}
    height={size}
  />
);

const DOMAIN_ICONS: Record<string, React.ReactNode> = {
  '':          PH('sparkle-fill'),
  'dev':       PH('code-simple-bold'),
  'recipe':    PH('cooking-pot-fill'),
  'generated': PH('hammer-fill'),
  'community': PH('users-three-fill'),
  'youtube':   <img src="https://cdn.simpleicons.org/youtube/7C3AED" alt="YouTube" width="22" height="22" />,
  'devto': (
    <div className="flex items-center gap-1">
      <img src="https://cdn.simpleicons.org/devdotto/7C3AED" alt="DEV.to" width="16" height="16" />
      <img src="https://cdn.simpleicons.org/reddit/7C3AED" alt="Reddit" width="16" height="16" />
    </div>
  ),
};

type Tab = 'recent' | 'trending';

// ── Animated counter ──────────────────────────────────────────────────────────

function AnimatedNumber({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [current, setCurrent] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (target === 0) return;
    const duration = 1400;
    const start = performance.now();
    const animate = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      setCurrent(Math.floor(eased * target));
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target]);

  const fmt = current >= 1000 ? `${(current / 1000).toFixed(current >= 10000 ? 0 : 1)}k` : String(current);
  return <span>{fmt}{suffix}</span>;
}

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

// ── Main ──────────────────────────────────────────────────────────────────────

export function HomePage() {
  const [search, setSearch]               = useState('');
  const [activeDomain, setActiveDomain]   = useState('');
  const [activeTab, setActiveTab]         = useState<Tab>('recent');
  const [feedKey, setFeedKey]             = useState(0);
  const [searchFocused, setSearchFocused] = useState(false);
  const navigate  = useNavigate();
  const { isAuthenticated } = useAuthStore();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = search.trim();
    const sourceParam = activeDomain ? `&source=${activeDomain}` : '';
    if (q) navigate(`/tutorials?search=${encodeURIComponent(q)}${sourceParam}`);
    else navigate(activeDomain ? `/tutorials?source=${activeDomain}` : '/tutorials');
  };

  const switchTab    = (tab: Tab)       => { setActiveTab(tab); setFeedKey(k => k + 1); };
  const switchDomain = (source: string) => { setActiveDomain(source); setFeedKey(k => k + 1); setActiveTab('recent'); };

  // Navigation vers la page catégorie dédiée
  const goToCategory = (source: string) => {
    if (!source) navigate('/tutorials');
    else navigate(`/category/${source}`);
  };

  // Platform stats (public catalogue overview)
  const { data: stats } = useQuery<{ tutorials: number; views: number; members: number }>({
    queryKey: ['platform-stats'],
    queryFn: async () => {
      const overview = await statsApi.overview();
      return {
        tutorials: overview.totals.tutorials,
        views: overview.totals.views,
        members: overview.totals.learners,
      };
    },
    staleTime: 10 * 60 * 1000,
  });

  const isDevDomain = activeDomain === 'dev';

  // Progress widget
  const { data: progressItems = [] } = useProgress();
  const { data: progressStats } = useQuery<{ total: number; streak: number; badges: { id: string; label: string; icon: string }[] }>({
    queryKey: ['progress-stats'],
    queryFn: async () => { const { data } = await apiClient.get('/api/progress/stats'); return data; },
    enabled: isAuthenticated(),
    staleTime: 5 * 60 * 1000,
  });

  const doneCount    = progressItems.filter(i => i.isDone).length;
  const ongoingItems = progressItems.filter(i => !i.isDone).slice(0, 3);
  const showWidget   = isAuthenticated() && progressItems.length > 0;

  // Feed query
  const { data: feedData, isLoading: feedLoading } = useQuery({
    queryKey: ['home-feed', activeTab, activeDomain],
    queryFn: () => {
      if (activeTab === 'trending') {
        return tutorialsApi.getAll({
          source: isDevDomain ? 'dev' : (activeDomain || undefined),
          order: { viewCount: 'desc' },
        });
      }
      if (activeDomain) {
        return tutorialsApi.getAll({ source: isDevDomain ? 'dev' : activeDomain, order: { createdAt: 'desc' } });
      }
      return tutorialsApi.getDiverseFeed();
    },
    staleTime: 3 * 60 * 1000,
  });

  const { data: devtoFeedData, isLoading: devtoLoading } = useQuery({
    queryKey: ['home-feed-devto', activeTab],
    queryFn: () => tutorialsApi.getAll({
      source: 'devto',
      order: activeTab === 'trending' ? { viewCount: 'desc' } : { createdAt: 'desc' },
    }),
    enabled: isDevDomain,
    staleTime: 3 * 60 * 1000,
  });

  const tutorials      = (feedData?.member ?? []).slice(0, isDevDomain ? 4 : 8);
  const devtoTutorials = (devtoFeedData?.member ?? []).slice(0, 4);
  const allIds         = [...tutorials.map(t => t.id), ...devtoTutorials.map(t => t.id)];

  const { data: ratingsMap = {} } = useQuery({
    queryKey: ['ratings-batch-home', allIds],
    queryFn: async () => {
      if (!allIds.length) return {};
      const { data } = await apiClient.get<Record<number, { average: number; count: number }>>(
        `/api/tutorial-ratings/batch?ids=${allIds.join(',')}`
      );
      return data;
    },
    enabled: allIds.length > 0,
  });

  const activeDomainObj = DOMAINS.find(d => d.source === activeDomain);

  return (
    <div className="min-h-screen bg-white">
      <Seo
        title="YourTuto · Tous les meilleurs tutoriels au même endroit"
        description="YourTuto rassemble les meilleurs tutoriels dev, IA, bricolage et cuisine : YouTube, DEV.to, Reddit, recettes et tutoriels de la communauté, au même endroit."
        canonical="/"
        jsonLd={[{
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: 'YourTuto',
          url: absoluteUrl('/'),
          inLanguage: 'fr',
          potentialAction: {
            '@type': 'SearchAction',
            target: `${absoluteUrl('/tutorials')}?search={search_term_string}`,
            'query-input': 'required name=search_term_string',
          },
        }]}
      />

      {/* ── HERO — seule section sombre ───────────────────────────────────── */}
      <section className="relative overflow-hidden" style={{ background: '#0D0D14', borderBottom: '1px solid #1A1A2E' }}>
        <GrainOverlay />

        {/* Floating blobs — ambiance premium, pas de grid */}
        <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
          <div className="ni-blob absolute" style={{
            width: '600px', height: '600px',
            top: '-200px', right: '-100px',
            borderRadius: '50%',
            background: 'radial-gradient(ellipse, rgba(124,58,237,0.07) 0%, transparent 70%)',
          }} />
          <div className="ni-blob-2 absolute" style={{
            width: '400px', height: '400px',
            bottom: '-100px', left: '-80px',
            borderRadius: '50%',
            background: 'radial-gradient(ellipse, rgba(139,92,246,0.05) 0%, transparent 70%)',
          }} />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto px-6 pt-16 pb-20">

          {/* Pill badge */}
          <div className="inline-flex items-center gap-2.5 mb-10" style={{
            border: '1px solid rgba(124,58,237,0.2)',
            background: 'rgba(124,58,237,0.06)',
            padding: '6px 16px',
            borderRadius: '20px',
          }}>
            <span className="w-1.5 h-1.5 rounded-full bg-[#7C3AED] animate-pulse" />
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', letterSpacing: '0.03em', color: '#8B7EC8' }}>
              Dev · Cuisine · Bricolage · YouTube · Communauté
            </span>
          </div>

          {/* Layout : titre à gauche, recherche à droite */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.15fr] gap-12 lg:gap-20 items-center">

            {/* Left: Title + Stats */}
            <div>
              <h1 className="ni-display mb-5" style={{ fontSize: 'clamp(48px, 7vw, 80px)' }}>
                <span style={{ display: 'block', color: '#E8E8F2' }}>Apprends.</span>
                <span style={{ display: 'block', color: '#7C3AED' }}>Construis.</span>
                <span style={{ display: 'block', color: '#E8E8F2', fontWeight: 300, fontStyle: 'italic' }}>Partage.</span>
              </h1>

              <p style={{ fontSize: '15px', color: '#6B6B8A', lineHeight: '1.75', maxWidth: '380px', marginBottom: '36px', fontFamily: 'Inter, sans-serif' }}>
                Tutoriels communauté, YouTube, DEV.to,
                Reddit, recettes — tout en un seul endroit.
              </p>

              {/* Stats */}
              {stats && (
                <div className="flex items-stretch gap-3">
                  {[
                    { val: stats.tutorials, label: 'Tutoriels' },
                    { val: stats.views,     label: 'Vues'      },
                    { val: stats.members,   label: 'Membres'   },
                  ].map((s, i) => (
                    <div key={i} style={{
                      flex: 1,
                      padding: '14px 16px',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      borderRadius: '12px',
                    }}>
                      <p className="ni-display" style={{ fontSize: '26px', color: '#7C3AED', lineHeight: 1 }}>
                        <AnimatedNumber target={s.val} suffix="+" />
                      </p>
                      <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', color: '#4A4A66', marginTop: '4px', fontWeight: 500 }}>
                        {s.label}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {!isAuthenticated() && (
                <div className="flex items-center gap-4 mt-8">
                  <Link to="/register"
                    className="ni-btn-primary"
                    style={{ fontSize: '14px', padding: '11px 24px' }}>
                    Créer un compte →
                  </Link>
                  <Link to="/login"
                    style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif', color: '#5A5A7A', textDecoration: 'underline', textUnderlineOffset: '4px' }}>
                    Se connecter
                  </Link>
                </div>
              )}
            </div>

            {/* Right: Search */}
            <div>
              <form onSubmit={handleSearch}>
                <div className={`ni-search-wrap${searchFocused ? ' ni-search-active' : ''}`}
                  style={{ marginBottom: '16px' }}>
                  <div className="flex items-center" style={{ padding: '0 16px', gap: '12px' }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
                      style={{ flexShrink: 0, color: searchFocused ? '#7C3AED' : '#3A3A52', transition: 'color 0.25s' }}>
                      <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.5"/>
                      <path d="M10.5 10.5L13.5 13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                    <input
                      type="search"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      onFocus={() => setSearchFocused(true)}
                      onBlur={() => setSearchFocused(false)}
                      placeholder={activeDomainObj ? `Rechercher dans ${activeDomainObj.label}…` : 'Rechercher un tutoriel, une recette, un projet…'}
                      className="ni-search-input"
                      style={{ flex: 1, padding: '18px 0', background: 'transparent', border: 'none', outline: 'none', fontFamily: 'Inter, sans-serif', fontSize: '14px', color: '#E8E8F2' }}
                    />
                    <button type="submit" className="ni-btn-primary shrink-0"
                      style={{ fontSize: '13px', fontWeight: 600, padding: '9px 18px' }}>
                      Rechercher
                    </button>
                  </div>
                </div>
              </form>

              {/* Domain pills */}
              <div className="flex flex-wrap gap-2 mt-4">
                {DOMAINS.map(d => (
                  <button
                    key={d.source}
                    onClick={() => switchDomain(d.source)}
                    className="ni-tag-btn"
                    style={{
                      fontSize: '12px',
                      fontFamily: 'Inter, sans-serif',
                      fontWeight: 500,
                      padding: '6px 14px',
                      background: activeDomain === d.source ? 'rgba(124,58,237,0.15)' : 'transparent',
                      color: activeDomain === d.source ? '#c4b5fd' : '#4A4A66',
                      border: `1px solid ${activeDomain === d.source ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.06)'}`,
                      cursor: 'pointer',
                    }}
                  >
                    {d.label}
                  </button>
                ))}
              </div>

              {/* Feature list subtile */}
              <div className="mt-8 hidden lg:flex flex-col gap-2">
                {[
                  'Plateforme ouverte à tous les niveaux',
                  'Contenu sélectionné + communautaire',
                  'Gratuit, sans abonnement',
                ].map((txt, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#7C3AED', flexShrink: 0 }} />
                    <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: '#3A3A5C' }}>{txt}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── DOMAIN CARDS ──────────────────────────────────────────────────── */}
      <section className="relative" style={{ background: '#F5F3FF', borderBottom: '1px solid #ede9fe' }}>
        <div className="max-w-6xl mx-auto px-6 py-12">

          <div className="flex items-center gap-4 mb-8">
            <span className="ni-label" style={{ color: '#7c3aed' }}>Explorer par domaine</span>
            <div style={{ flex: 1, height: '1px', background: '#ddd6fe' }} />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {DOMAINS.map((d) => {
              const isActive = activeDomain === d.source;
              return (
                <button
                  key={d.source}
                  onClick={() => goToCategory(d.source)}
                  className="ni-domain-card"
                  style={{
                    padding: 0,
                    cursor: 'pointer',
                    border: `2px solid ${isActive ? '#7C3AED' : '#e4e4e7'}`,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    position: 'relative',
                    overflow: 'hidden',
                    minHeight: '148px',
                    background: '#ffffff',
                    boxShadow: isActive ? '0 0 0 3px rgba(124,58,237,0.15), 0 8px 24px rgba(124,58,237,0.15)' : '0 1px 4px rgba(0,0,0,0.06)',
                  }}
                  data-active={isActive}
                >
                  {/* Photo Unsplash en fond */}
                  <img
                    src={unsplash(d.source)}
                    alt=""
                    aria-hidden="true"
                    className="ni-domain-bg-img"
                    style={{
                      position: 'absolute', inset: 0,
                      width: '100%', height: '100%',
                      objectFit: 'cover',
                      transition: 'transform 0.45s ease',
                    }}
                  />

                  {/* Gradient overlay — léger pour laisser voir la photo */}
                  <div style={{
                    position: 'absolute', inset: 0,
                    background: isActive
                      ? 'linear-gradient(160deg, rgba(109,40,217,0.55) 0%, rgba(13,13,20,0.75) 100%)'
                      : 'linear-gradient(160deg, rgba(0,0,0,0.28) 0%, rgba(0,0,0,0.55) 100%)',
                    transition: 'background 0.3s',
                    zIndex: 1,
                  }} />

                  {/* Contenu flottant au dessus */}
                  <div style={{
                    position: 'relative', zIndex: 2,
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    gap: '10px',
                    width: '100%', height: '100%',
                    padding: '20px 10px',
                  }}>
                    {/* Icône avec fond glassmorphism */}
                    <div style={{
                      width: '42px', height: '42px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: isActive ? 'rgba(255,255,255,0.18)' : 'rgba(13,13,20,0.5)',
                      backdropFilter: 'blur(8px)',
                      border: `1px solid ${isActive ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)'}`,
                      borderRadius: '10px',
                      flexShrink: 0,
                    }}>
                      <span style={{ filter: isActive ? 'brightness(0) invert(1)' : 'brightness(1.3)' }}>
                        {DOMAIN_ICONS[d.source] ?? <span style={{ fontSize: '18px' }}>{d.emoji}</span>}
                      </span>
                    </div>

                    <div style={{ textAlign: 'center' }}>
                      <p style={{
                        fontFamily: 'Inter, sans-serif',
                        fontWeight: 600,
                        fontSize: '12px',
                        color: isActive ? '#ffffff' : '#D0D0E8',
                        lineHeight: 1.2,
                        textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                      }}>
                        {d.label}
                      </p>
                      <p style={{
                        fontFamily: 'Inter, sans-serif',
                        fontWeight: 400,
                        fontSize: '10px',
                        color: isActive ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.3)',
                        lineHeight: 1.3,
                        marginTop: '3px',
                        textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                      }}>
                        {d.desc}
                      </p>
                    </div>
                  </div>

                  {/* Badge actif */}
                  {isActive && (
                    <div style={{
                      position: 'absolute', top: '8px', right: '8px', zIndex: 3,
                      width: '8px', height: '8px',
                      borderRadius: '50%',
                      background: '#a78bfa',
                      boxShadow: '0 0 6px rgba(167,139,250,0.8)',
                    }} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── PROGRESS WIDGET ───────────────────────────────────────────────── */}
      {showWidget && (
        <section style={{ background: '#fafafa', borderBottom: '1px solid #f0eeff' }}>
          <div className="max-w-6xl mx-auto px-6 py-8">
            <div style={{
              border: '1px solid #ede9fe',
              background: '#f5f3ff',
              padding: '20px 24px',
              borderRadius: '16px',
            }}>
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <p className="ni-label" style={{ color: '#7c3aed', marginBottom: '6px' }}>Mon parcours</p>
                  <p className="ni-display" style={{ fontSize: '20px', color: '#1e1b4b' }}>
                    Reprends où tu en étais
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {(progressStats?.streak ?? 0) > 0 && (
                    <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: '#7c3aed', background: '#ede9fe', border: '1px solid #ddd6fe', padding: '5px 12px', borderRadius: '20px' }}>
                      🔥 {progressStats!.streak} jours de suite
                    </span>
                  )}
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: '#71717a', background: '#ffffff', border: '1px solid #e4e4e7', padding: '5px 12px', borderRadius: '20px' }}>
                    {doneCount} terminé{doneCount !== 1 ? 's' : ''}
                  </span>
                  <Link to="/my-progress" className="ni-btn-primary" style={{ fontSize: '12px', fontWeight: 600, padding: '7px 14px' }}>
                    Voir tout →
                  </Link>
                </div>
              </div>

              {ongoingItems.length > 0 && (
                <div className="flex gap-2 overflow-x-auto scrollbar-none">
                  {ongoingItems.map(item => {
                    const slug = item.itemSlug;
                    let href = '/my-progress';
                    if (item.source === 'community' || item.source === 'generated' || item.source === 'dev') href = `/tutorials/${slug}`;
                    else if (item.source === 'devto')   href = `/devto/${slug}`;
                    else if (item.source === 'reddit')  href = `/reddit/${slug.replace('reddit-', '')}`;
                    else if (item.source === 'youtube') href = `/youtube/${slug}`;
                    else if (item.source === 'recipe') {
                      if (slug.startsWith('mealdb-')) href = `/recipe/${slug.replace('mealdb-', '')}`;
                      else if (!slug.startsWith('spoonacular-')) href = `/tutorials/${slug}`;
                    }
                    return (
                      <Link key={item.id} to={href}
                        className="ni-progress-item shrink-0 flex items-center gap-3"
                        style={{
                          background: '#ffffff',
                          border: '1px solid #e4e4e7',
                          padding: '10px 14px',
                          maxWidth: '220px', minWidth: '160px',
                        }}>
                        {item.thumbnailUrl ? (
                          <img src={item.thumbnailUrl} alt={item.title}
                            className="shrink-0 object-cover"
                            style={{ width: '32px', height: '32px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)' }} />
                        ) : (
                          <div style={{ width: '32px', height: '32px', background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', flexShrink: 0 }}>
                            {item.source === 'recipe' ? '🍳' : item.source === 'generated' ? '⚙' : '◈'}
                          </div>
                        )}
                        <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: '13px', color: '#9A9AB8', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {item.title}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── FEED — fond clair pour cohérence avec les cards blanches ─────── */}
      <section style={{ background: '#F8F8FF' }}>
        <div className="max-w-7xl mx-auto px-6 py-12">

          {/* Tabs + lien */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-1" style={{
              background: '#ffffff',
              border: '1px solid #e4e4e7',
              borderRadius: '10px',
              padding: '4px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            }}>
              {(['recent', 'trending'] as Tab[]).map(tab => (
                <button
                  key={tab}
                  onClick={() => switchTab(tab)}
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '13px',
                    fontWeight: 500,
                    padding: '8px 18px',
                    background: activeTab === tab ? '#7C3AED' : 'transparent',
                    color: activeTab === tab ? '#ffffff' : '#71717a',
                    border: 'none',
                    cursor: 'pointer',
                    borderRadius: '7px',
                    transition: 'all 0.18s',
                    boxShadow: activeTab === tab ? '0 2px 8px rgba(124,58,237,0.3)' : 'none',
                  }}
                >
                  {tab === 'recent' ? '✦ Récents' : '↑ Tendances'}
                </button>
              ))}
            </div>

            <Link
              to={activeDomain ? `/tutorials?source=${activeDomain}` : '/tutorials'}
              style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: '#a1a1aa', textDecoration: 'underline', textUnderlineOffset: '4px', transition: 'color 0.18s' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#7C3AED')}
              onMouseLeave={e => (e.currentTarget.style.color = '#a1a1aa')}
            >
              Tout voir →
            </Link>
          </div>

          {/* Feed content */}
          {feedLoading ? (
            <div className="flex justify-center py-24">
              <div style={{ width: '32px', height: '32px', border: '2px solid #7C3AED', borderTopColor: 'transparent', borderRadius: '50%' }} className="animate-spin" />
            </div>
          ) : isDevDomain ? (
            <div key={feedKey} className="space-y-12 animate-fade-in">
              {/* Général */}
              <div>
                <div className="flex items-center gap-3 mb-5">
                  <span style={{ width: '5px', height: '5px', background: '#7C3AED', display: 'inline-block', flexShrink: 0, borderRadius: '50%' }} />
                  <span className="ni-label" style={{ color: '#a1a1aa' }}>Général</span>
                  <div style={{ flex: 1, height: '1px', background: '#e4e4e7' }} />
                  <Link to="/tutorials?source=dev" style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: '#a1a1aa', textDecoration: 'underline', textUnderlineOffset: '3px' }}>
                    Tout voir →
                  </Link>
                </div>
                {tutorials.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {tutorials.map((t, i) => (
                      <div key={t.id} className="animate-slide-up" style={{ animationDelay: `${i * 50}ms`, animationFillMode: 'both' }}>
                        <TutorialCard tutorial={t} rating={ratingsMap[t.id]} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', color: '#2A2A3E', padding: '24px 0' }}>Aucun tutoriel pour ce filtre.</p>
                )}
              </div>

              {/* DEV.to */}
              <div>
                <div className="flex items-center gap-3 mb-5">
                  <span style={{ width: '5px', height: '5px', background: '#818CF8', display: 'inline-block', flexShrink: 0, borderRadius: '50%' }} />
                  <span className="ni-label" style={{ color: '#a1a1aa' }}>DEV.to</span>
                  <div style={{ flex: 1, height: '1px', background: '#e4e4e7' }} />
                  <Link to="/tutorials?source=devto" style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: '#a1a1aa', textDecoration: 'underline', textUnderlineOffset: '3px' }}>
                    Tout voir →
                  </Link>
                </div>
                {devtoLoading ? (
                  <div className="flex justify-center py-10">
                    <div style={{ width: '28px', height: '28px', border: '2px solid #7C3AED', borderTopColor: 'transparent', borderRadius: '50%' }} className="animate-spin" />
                  </div>
                ) : devtoTutorials.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {devtoTutorials.map((t, i) => (
                      <div key={t.id} className="animate-slide-up" style={{ animationDelay: `${(i + 4) * 50}ms`, animationFillMode: 'both' }}>
                        <TutorialCard tutorial={t} rating={ratingsMap[t.id]} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', color: '#2A2A3E', padding: '24px 0' }}>Aucun article DEV.to disponible.</p>
                )}
              </div>
            </div>
          ) : (
            <div key={feedKey} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-fade-in">
              {tutorials.map((t, i) => (
                <div key={t.id} className="animate-slide-up" style={{ animationDelay: `${i * 50}ms`, animationFillMode: 'both' }}>
                  <TutorialCard tutorial={t} rating={ratingsMap[t.id]} />
                </div>
              ))}
            </div>
          )}

          {tutorials.length === 0 && !feedLoading && !isDevDomain && (
            <div className="text-center py-24">
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', color: '#2A2A3E' }}>
                Aucun tutoriel pour ce filtre.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
