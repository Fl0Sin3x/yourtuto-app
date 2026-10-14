import { useRef, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

export function Navbar() {
  const { user, logout, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleLogout = () => { logout(); navigate('/login'); };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <nav style={{ background: '#0D0D14', borderBottom: '1px solid #1E1E2C' }} className="sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-5 h-14 flex items-center justify-between">

        {/* Logo */}
        <Link to="/" replace className="flex items-center group shrink-0">
          <img src="/Yourtutodark.svg" alt="YourTuto" className="h-20 sm:h-24 w-auto" />
        </Link>

        <div className="flex items-center gap-1">
          {/* Mobile: burger toggles the primary links (hidden below sm) */}
          <button
            type="button"
            className="sm:hidden p-2 rounded-lg"
            style={{ color: '#E8E8F2' }}
            aria-label={mobileOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
            onClick={() => setMobileOpen((o) => !o)}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              {mobileOpen
                ? <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                : <path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />}
            </svg>
          </button>
          <Link
            to="/tutorials"
            className="hidden sm:inline-block px-3 py-1.5 text-sm rounded-lg transition-colors"
            style={{ color: '#5A5A72', fontFamily: 'Inter, sans-serif' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#E8E8F2')}
            onMouseLeave={e => (e.currentTarget.style.color = '#5A5A72')}
          >
            Tutoriels
          </Link>
          <Link
            to="/paths"
            className="hidden sm:inline-block px-3 py-1.5 text-sm rounded-lg transition-colors"
            style={{ color: '#5A5A72', fontFamily: 'Inter, sans-serif' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#E8E8F2')}
            onMouseLeave={e => (e.currentTarget.style.color = '#5A5A72')}
          >
            Parcours
          </Link>
          <Link
            to="/stats"
            className="hidden sm:inline-block px-3 py-1.5 text-sm rounded-lg transition-colors"
            style={{ color: '#5A5A72', fontFamily: 'Inter, sans-serif' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#E8E8F2')}
            onMouseLeave={e => (e.currentTarget.style.color = '#5A5A72')}
          >
            Stats
          </Link>

          {isAuthenticated() ? (
            <>
              <Link
                to="/tutorials/create"
                className="flex items-center gap-1.5 ml-1 px-3.5 py-1.5 text-sm font-semibold whitespace-nowrap transition-all"
                style={{
                  background: 'linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)',
                  color: '#ffffff',
                  borderRadius: '4px',
                  fontFamily: 'Inter, sans-serif',
                  boxShadow: '0 4px 14px rgba(124,58,237,0.2)',
                }}
              >
                <span className="text-base leading-none font-light">+</span>
                Publier
              </Link>

              <div ref={menuRef} className="relative ml-1">
                <button
                  onClick={() => setMenuOpen((o) => !o)}
                  className="flex items-center focus:outline-none"
                >
                  {user?.profilePicture ? (
                    <img
                      src={user.profilePicture}
                      alt={user?.username}
                      className="w-8 h-8 rounded-full object-cover transition-all"
                      style={{ boxShadow: menuOpen ? '0 0 0 2px #7C3AED' : '0 0 0 2px #2A2A3A' }}
                    />
                  ) : (
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold transition-all"
                      style={{
                        background: 'linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)',
                        boxShadow: menuOpen ? '0 0 0 2px #7C3AED' : '0 0 0 2px #2A2A3A',
                      }}
                    >
                      {user?.username?.slice(0, 2).toUpperCase() ?? '??'}
                    </div>
                  )}
                </button>

                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-52 py-1.5 z-50"
                    style={{ background: '#12121E', border: '1px solid #1E1E2C', borderRadius: '4px', boxShadow: '0 12px 40px rgba(0,0,0,0.5)' }}>
                    <div className="px-4 py-2.5 mb-1" style={{ borderBottom: '1px solid #1E1E2C' }}>
                      <p className="text-xs font-semibold truncate" style={{ color: '#E8E8F2', fontFamily: 'Inter, sans-serif' }}>{user?.username}</p>
                      <p className="text-xs truncate mt-0.5" style={{ color: '#3A3A52', fontFamily: 'Inter, sans-serif' }}>{user?.email}</p>
                    </div>

                    {[
                      { to: '/my-tutorials', label: 'Mes tutos', icon: <path d="M2 3h11M2 7.5h11M2 12h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/> },
                      { to: '/my-progress', label: 'Mon parcours', icon: <><path d="M2 2l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><rect x="1" y="1" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.5"/></> },
                      { to: '/favorites', label: 'Mes favoris', icon: <path d="M3 1a1 1 0 0 0-1 1v11.5l5-3.5 5 3.5V2a1 1 0 0 0-1-1H3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/> },
                      { to: '/collections', label: 'Mes collections', icon: <><rect x="1.5" y="3" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><path d="M4 1h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></> },
                      { to: '/profile', label: 'Réglages', icon: <><circle cx="7.5" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.5"/><path d="M2 13c0-3 2.5-4.5 5.5-4.5S13 10 13 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></> },
                    ].map(item => (
                      <Link
                        key={item.to}
                        to={item.to}
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2 text-sm transition-colors"
                        style={{ color: '#8A8AA2', fontFamily: 'Inter, sans-serif' }}
                        onMouseEnter={e => { e.currentTarget.style.color = '#E8E8F2'; e.currentTarget.style.background = '#1A1A28'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = '#8A8AA2'; e.currentTarget.style.background = 'transparent'; }}
                      >
                        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ color: '#3A3A52', flexShrink: 0 }}>{item.icon}</svg>
                        {item.label}
                      </Link>
                    ))}

                    <div style={{ borderTop: '1px solid #1E1E2C', marginTop: '4px', paddingTop: '4px' }}>
                      <button
                        onClick={() => { setMenuOpen(false); handleLogout(); }}
                        className="w-full flex items-center gap-2.5 px-4 py-2 text-sm transition-colors"
                        style={{ color: '#e05555', fontFamily: 'Inter, sans-serif' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#1A1218')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ flexShrink: 0, color: '#e05555' }}>
                          <path d="M6 2H3a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h3M10 10l3-3-3-3M13 7H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        Déconnexion
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link to="/login"
                className="hidden sm:inline-block px-3 py-1.5 text-sm transition-colors"
                style={{ color: '#5A5A72', fontFamily: 'Inter, sans-serif' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#E8E8F2')}
                onMouseLeave={e => (e.currentTarget.style.color = '#5A5A72')}
              >
                Connexion
              </Link>
              <Link
                to="/register"
                className="ml-1 px-3.5 py-1.5 text-sm font-semibold whitespace-nowrap transition-all"
                style={{
                  background: 'linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)',
                  color: '#ffffff',
                  borderRadius: '4px',
                  fontFamily: 'Inter, sans-serif',
                  boxShadow: '0 4px 14px rgba(124,58,237,0.2)',
                }}
              >
                S'inscrire
              </Link>
            </>
          )}
        </div>
      </div>
      {mobileOpen && (
        <div id="mobile-nav" className="sm:hidden flex flex-col px-5 pb-3" style={{ borderTop: '1px solid #1E1E2C' }}>
          <Link to="/tutorials" onClick={() => setMobileOpen(false)} className="px-2 py-2 text-sm rounded-lg" style={{ color: '#E8E8F2' }}>Tutoriels</Link>
          <Link to="/paths" onClick={() => setMobileOpen(false)} className="px-2 py-2 text-sm rounded-lg" style={{ color: '#E8E8F2' }}>Parcours</Link>
          <Link to="/stats" onClick={() => setMobileOpen(false)} className="px-2 py-2 text-sm rounded-lg" style={{ color: '#E8E8F2' }}>Stats</Link>
          {!isAuthenticated() && <Link to="/login" onClick={() => setMobileOpen(false)} className="px-2 py-2 text-sm rounded-lg" style={{ color: '#E8E8F2' }}>Connexion</Link>}
        </div>
      )}
    </nav>
  );
}
