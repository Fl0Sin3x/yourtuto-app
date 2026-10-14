import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi } from '../api/auth';
import { useAuthStore } from '../store/authStore';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface rounded-2xl border border-border shadow-sm p-6">
      <h2 className="text-base font-semibold text-text mb-4">{title}</h2>
      {children}
    </div>
  );
}

function Alert({ type, message }: { type: 'success' | 'error'; message: string }) {
  return (
    <p className={`text-sm mt-3 ${type === 'success' ? 'text-success' : 'text-danger'}`}>
      {message}
    </p>
  );
}

export function ProfilePage() {
  const setUser = useAuthStore((s) => s.setUser);
  const qc      = useQueryClient();

  const storeUser = useAuthStore((s) => s.user);

  const { data: user, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: authApi.me,
    initialData: storeUser ?? undefined,
    staleTime: 1000 * 60 * 5,
  });

  // — Avatar upload —
  const fileInputRef  = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [picStatus, setPicStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const pictureMutation = useMutation({
    mutationFn: (file: File) => authApi.uploadProfilePicture(file),
    onSuccess: (data) => {
      const updated = { ...user!, profilePicture: data.profilePicture };
      setUser(updated);
      qc.setQueryData(['me'], updated);
      setPreview(data.profilePicture);
      setPicStatus({ type: 'success', msg: 'Photo mise à jour.' });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Erreur upload.';
      setPicStatus({ type: 'error', msg });
      setPreview(null);
    },
  });

  const deletePictureMutation = useMutation({
    mutationFn: authApi.deleteProfilePicture,
    onSuccess: () => {
      setPreview(null);
      const updated = { ...user!, profilePicture: null };
      setUser(updated);
      qc.setQueryData(['me'], updated);
      setPicStatus({ type: 'success', msg: 'Photo supprimée.' });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    setPicStatus(null);
    pictureMutation.mutate(file);
  };

  // — Info form —
  const [infoForm, setInfoForm]     = useState({ username: '', bio: '' });
  const [infoStatus, setInfoStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync form with loaded user
    if (user) setInfoForm({ username: user.username, bio: user.bio ?? '' });
  }, [user]);

  const infoMutation = useMutation({
    mutationFn: () => authApi.updateProfile(infoForm),
    onSuccess: (updated) => {
      setUser(updated);
      qc.invalidateQueries({ queryKey: ['me'] });
      setInfoStatus({ type: 'success', msg: 'Profil mis à jour.' });
    },
    onError: () => setInfoStatus({ type: 'error', msg: 'Erreur lors de la mise à jour.' }),
  });

  // — Password form —
  const [pwForm, setPwForm]     = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [pwStatus, setPwStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const pwMutation = useMutation({
    mutationFn: () => {
      if (pwForm.newPassword !== pwForm.confirm) throw new Error('Les mots de passe ne correspondent pas.');
      return authApi.changePassword(pwForm.currentPassword, pwForm.newPassword);
    },
    onSuccess: () => {
      setPwForm({ currentPassword: '', newPassword: '', confirm: '' });
      setPwStatus({ type: 'success', msg: 'Mot de passe mis à jour.' });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { errors?: { currentPassword?: string } } } })?.response?.data?.errors?.currentPassword
        ?? (err as Error)?.message
        ?? 'Erreur.';
      setPwStatus({ type: 'error', msg });
    },
  });

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-3 border-violet-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const currentPic = preview ?? (user?.profilePicture ? user.profilePicture : null);
  const initials   = user?.username?.slice(0, 2).toUpperCase() ?? '?';

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 flex flex-col gap-5">

      {/* Header */}
      <div className="flex items-center gap-5 bg-surface rounded-2xl border border-border shadow-sm p-6">
        <div className="relative group">
          {currentPic ? (
            <img src={currentPic} alt="avatar" className="w-20 h-20 rounded-full object-cover border-2 border-border" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-violet-50 border border-violet-600/20 flex items-center justify-center text-violet-600 text-2xl font-bold">
              {initials}
            </div>
          )}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-medium transition-opacity"
          >
            Modifier
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-text">{user?.username}</h1>
          <p className="text-sm text-muted">{user?.email}</p>
          {pictureMutation.isPending && <p className="text-xs text-violet-600 mt-1">Envoi en cours...</p>}
          {picStatus && <Alert type={picStatus.type} message={picStatus.msg} />}
          {user?.profilePicture && !pictureMutation.isPending && (
            <button
              onClick={() => { setPicStatus(null); deletePictureMutation.mutate(); }}
              className="text-xs text-muted hover:text-danger mt-1 transition-colors"
            >
              Supprimer la photo
            </button>
          )}
        </div>
      </div>

      {/* Infos */}
      <Section title="Informations du profil">
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-medium text-text mb-1.5">Pseudo</label>
            <input
              type="text"
              value={infoForm.username}
              onChange={(e) => setInfoForm((p) => ({ ...p, username: e.target.value }))}
              className="w-full border border-border rounded-lg px-3.5 py-2.5 text-sm bg-surface text-text focus:outline-none focus:border-violet-600/50 focus:ring-3 focus:ring-brand/10 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text mb-1.5">Bio</label>
            <textarea
              value={infoForm.bio}
              onChange={(e) => setInfoForm((p) => ({ ...p, bio: e.target.value }))}
              rows={3}
              className="w-full border border-border rounded-lg px-3.5 py-2.5 text-sm bg-surface text-text placeholder:text-muted/60 focus:outline-none focus:border-violet-600/50 focus:ring-3 focus:ring-brand/10 transition-all resize-none"
              placeholder="Parle de toi..."
            />
          </div>
          <div>
            <button
              onClick={() => { setInfoStatus(null); infoMutation.mutate(); }}
              disabled={infoMutation.isPending}
              className="bg-violet-600 hover:bg-violet-800 text-white px-5 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors shadow-sm shadow-violet-500/20"
            >
              {infoMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
          {infoStatus && <Alert type={infoStatus.type} message={infoStatus.msg} />}
        </div>
      </Section>

      {/* Mot de passe */}
      <Section title="Changer le mot de passe">
        <div className="flex flex-col gap-4">
          {(['currentPassword', 'newPassword', 'confirm'] as const).map((field) => (
            <div key={field}>
              <label className="block text-xs font-medium text-text mb-1.5">
                {{ currentPassword: 'Mot de passe actuel', newPassword: 'Nouveau mot de passe', confirm: 'Confirmer le mot de passe' }[field]}
              </label>
              <input
                type="password"
                value={pwForm[field]}
                onChange={(e) => setPwForm((p) => ({ ...p, [field]: e.target.value }))}
                className="w-full border border-border rounded-lg px-3.5 py-2.5 text-sm bg-surface text-text focus:outline-none focus:border-violet-600/50 focus:ring-3 focus:ring-brand/10 transition-all"
              />
            </div>
          ))}
          <div>
            <button
              onClick={() => { setPwStatus(null); pwMutation.mutate(); }}
              disabled={pwMutation.isPending}
              className="bg-text hover:bg-text/80 text-surface px-5 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors"
            >
              {pwMutation.isPending ? 'Mise à jour...' : 'Changer le mot de passe'}
            </button>
          </div>
          {pwStatus && <Alert type={pwStatus.type} message={pwStatus.msg} />}
        </div>
      </Section>

    </div>
  );
}
