import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../api/auth';

export function ForgotPasswordPage() {
  const [email, setEmail]     = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authApi.forgotPassword(email);
      setSubmitted(true);
    } catch {
      setError('Une erreur est survenue. Réessaie dans quelques instants.');
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
          {submitted ? (
            <div className="text-center">
              <div className="w-14 h-14 bg-violet-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-zinc-900 mb-2">Email envoyé !</h2>
              <p className="text-sm text-zinc-500 leading-relaxed">
                Si un compte existe avec <strong className="text-zinc-700">{email}</strong>, tu recevras un lien de réinitialisation dans quelques minutes.
              </p>
              <p className="text-xs text-zinc-400 mt-3">Pense à vérifier tes spams.</p>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-bold text-zinc-900 mb-1">Mot de passe oublié ?</h1>
              <p className="text-sm text-zinc-400 mb-6">On t'envoie un lien pour le réinitialiser.</p>

              {error && (
                <div className="bg-red-50 text-red-600 text-sm rounded-xl px-4 py-3 mb-5 border border-red-100">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1.5">Email</label>
                  <input
                    type="email" placeholder="toi@example.com" value={email}
                    onChange={(e) => setEmail(e.target.value)} required
                    className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-500/10 transition-all"
                  />
                </div>
                <button
                  type="submit" disabled={loading}
                  className="mt-1 w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 disabled:opacity-60 text-white rounded-xl py-2.5 text-sm font-semibold transition-all shadow-lg shadow-violet-500/25"
                >
                  {loading ? 'Envoi en cours…' : 'Envoyer le lien'}
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
