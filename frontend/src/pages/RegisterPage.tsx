import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authApi } from '../api/auth';

export function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm]       = useState({ email: '', username: '', password: '' });
  const [confirm, setConfirm] = useState('');
  const [error, setError]     = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.password !== confirm) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    try {
      await authApi.register(form.email, form.username, form.password);
      navigate('/login');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { errors?: Record<string, string> } } })?.response?.data?.errors;
      setError(msg ? Object.values(msg).join(', ') : "Erreur lors de l'inscription.");
    }
  };

  const fields: { key: 'email' | 'username' | 'password'; label: string; type: string; placeholder: string }[] = [
    { key: 'email',    label: 'Email',       type: 'email',    placeholder: 'toi@example.com' },
    { key: 'username', label: 'Pseudo',       type: 'text',     placeholder: 'monpseudo' },
    { key: 'password', label: 'Mot de passe', type: 'password', placeholder: '8 caractères minimum' },
  ];

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        <div className="flex justify-center -mb-20">
          <img src="/Yourtuto (1).svg" alt="YourTuto" className="w-full max-w-sm" />
        </div>

        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-8">
          <h1 className="text-xl font-bold text-zinc-900 text-center mb-6">Créer un compte</h1>

          {error && (
            <div className="bg-red-50 text-red-600 text-sm rounded-xl px-4 py-3 mb-5 border border-red-100">
              {error}
            </div>
          )}

          {/* OAuth buttons */}
          <div className="flex flex-col gap-3 mb-5">
            <a
              href={`${import.meta.env.VITE_API_URL ?? ''}/auth/google/redirect`}
              className="flex items-center justify-center gap-2 w-full border border-zinc-200 rounded-xl py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-all"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
                <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
              </svg>
              Continuer avec Google
            </a>
            <a
              href={`${import.meta.env.VITE_API_URL ?? ''}/auth/github/redirect`}
              className="flex items-center justify-center gap-2 w-full border border-zinc-200 rounded-xl py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-all"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12Z"/>
              </svg>
              Continuer avec GitHub
            </a>
          </div>

          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-zinc-200" />
            <span className="text-xs text-zinc-400">ou</span>
            <div className="flex-1 h-px bg-zinc-200" />
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {fields.map(({ key, label, type, placeholder }) => (
              <div key={key}>
                <label className="block text-xs font-semibold text-zinc-700 mb-1.5">{label}</label>
                <input
                  name={key} value={form[key]} onChange={handleChange} required
                  type={type} placeholder={placeholder}
                  className="w-full border border-zinc-200 rounded-xl px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-500/10 transition-all"
                />
              </div>
            ))}
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">Confirmer le mot de passe</label>
              <input
                type="password" placeholder="••••••••" value={confirm}
                onChange={(e) => setConfirm(e.target.value)} required
                className={`w-full border rounded-xl px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-4 transition-all ${
                  confirm && confirm !== form.password
                    ? 'border-red-300 focus:border-red-400 focus:ring-red-500/10'
                    : 'border-zinc-200 focus:border-violet-400 focus:ring-violet-500/10'
                }`}
              />
            </div>
            <button
              type="submit"
              className="mt-1 w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white rounded-xl py-2.5 text-sm font-semibold transition-all shadow-lg shadow-violet-500/25"
            >
              Créer mon compte
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-zinc-400 mt-5">
          Déjà un compte ?{' '}
          <Link to="/login" className="text-violet-600 font-medium hover:text-violet-800 transition-colors">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}
