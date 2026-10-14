import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../api/auth';

export function ResetPasswordPage() {
  const [searchParams]          = useSearchParams();
  const navigate                = useNavigate();
  const token                   = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState(false);

  const passwordRules = [
    { ok: password.length >= 8,          label: '8 caractères minimum' },
    { ok: /[A-Z]/.test(password),        label: '1 majuscule' },
    { ok: /[a-z]/.test(password),        label: '1 minuscule' },
    { ok: /\d/.test(password),           label: '1 chiffre' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('Lien invalide. Refais une demande de réinitialisation.');
      return;
    }
    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    if (passwordRules.some(r => !r.ok)) {
      setError('Le mot de passe ne respecte pas les critères.');
      return;
    }

    setLoading(true);
    try {
      await authApi.resetPassword(token, password);
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'Lien invalide ou expiré. Refais une demande.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        <div className="flex justify-center -mb-20">
          <img src="/Yourtuto (1).svg" alt="YourTuto" className="w-full max-w-sm" />
        </div>

        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-8">
          {success ? (
            <div className="text-center">
              <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-zinc-900 mb-2">Mot de passe mis à jour !</h2>
              <p className="text-sm text-zinc-500">Redirection vers la connexion…</p>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-bold text-zinc-900 mb-1">Nouveau mot de passe</h1>
              <p className="text-sm text-zinc-400 mb-6">Choisis un mot de passe solide.</p>

              {error && (
                <div className="bg-red-50 text-red-600 text-sm rounded-xl px-4 py-3 mb-5 border border-red-100">
                  {error}
                </div>
              )}

              {!token && (
                <div className="bg-amber-50 text-amber-700 text-sm rounded-xl px-4 py-3 mb-5 border border-amber-100">
                  Lien invalide. <Link to="/forgot-password" className="underline font-medium">Refaire une demande</Link>
                </div>
              )}

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1.5">Nouveau mot de passe</label>
                  <input
                    type="password" placeholder="••••••••" value={password}
                    onChange={(e) => setPassword(e.target.value)} required
                    className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-500/10 transition-all"
                  />
                  {password && (
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                      {passwordRules.map(r => (
                        <span key={r.label} className={`text-xs flex items-center gap-1 ${r.ok ? 'text-green-600' : 'text-zinc-400'}`}>
                          <span>{r.ok ? '✓' : '·'}</span> {r.label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1.5">Confirmer</label>
                  <input
                    type="password" placeholder="••••••••" value={confirm}
                    onChange={(e) => setConfirm(e.target.value)} required
                    className={`w-full border rounded-xl px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-4 transition-all ${
                      confirm && confirm !== password
                        ? 'border-red-300 focus:border-red-400 focus:ring-red-500/10'
                        : 'border-zinc-200 focus:border-violet-400 focus:ring-violet-500/10'
                    }`}
                  />
                </div>
                <button
                  type="submit" disabled={loading || !token}
                  className="mt-1 w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 disabled:opacity-60 text-white rounded-xl py-2.5 text-sm font-semibold transition-all shadow-lg shadow-violet-500/25"
                >
                  {loading ? 'Enregistrement…' : 'Réinitialiser le mot de passe'}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-sm text-zinc-400 mt-5">
          <Link to="/login" className="text-violet-600 font-medium hover:text-violet-800 transition-colors">
            ← Retour à la connexion
          </Link>
        </p>
      </div>
    </div>
  );
}
