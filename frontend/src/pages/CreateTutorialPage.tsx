import type { TutorialSource } from '../types';
import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import MDEditor from '@uiw/react-md-editor';
import { tutorialsApi } from '../api/tutorials';
import { categoriesApi } from '../api/categories';
import { useAuthStore } from '../store/authStore';

type ApiError = { response?: { data?: { detail?: string; 'hydra:description'?: string } } };

export function CreateTutorialPage() {
  const navigate  = useNavigate();
  const qc        = useQueryClient();
  const { isAuthenticated } = useAuthStore();

  const [title, setTitle]               = useState('');
  const [description, setDescription]   = useState('');
  const [content, setContent]           = useState('');
  const [difficulty, setDifficulty]     = useState('');
  const [duration, setDuration]         = useState('');
  const [selectedCats, setSelectedCats] = useState<number[]>([]);
  const [tagInput, setTagInput]         = useState('');
  const [tags, setTags]                 = useState<string[]>([]);
  const [error, setError]               = useState<string | null>(null);
  const tagRef = useRef<HTMLInputElement>(null);

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: categoriesApi.getAll,
    staleTime: Infinity,
  });

  const mutation = useMutation({
    mutationFn: () => tutorialsApi.create({
      title,
      description: description  || undefined,
      content:     content      || undefined,
      difficulty:  (difficulty || undefined) as 'beginner' | 'intermediate' | 'advanced' | undefined,
      duration:    duration     || undefined,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- API Platform expects IRIs/embedded objects here
      categories:  selectedCats.map((id) => `/api/categories/${id}`) as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- API Platform expects IRIs/embedded objects here
      tags:        tags.map((name) => ({ name })) as any,
      source:      'community' as TutorialSource,
    }),
    onSuccess: (tutorial) => {
      qc.invalidateQueries({ queryKey: ['tutorials'] });
      navigate(`/tutorials/${tutorial.id}`);
    },
    onError: (err: ApiError) => {
      setError(err.response?.data?.detail ?? err.response?.data?.['hydra:description'] ?? 'Une erreur est survenue.');
    },
  });

  if (!isAuthenticated()) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="w-14 h-14 rounded-2xl bg-violet-50 border border-violet-600/20 flex items-center justify-center mx-auto mb-4">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-violet-600">
            <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
        <p className="text-text font-semibold mb-2">Connexion requise</p>
        <p className="text-sm text-muted mb-5">Tu dois être connecté pour publier un tutoriel.</p>
        <button
          onClick={() => navigate('/login')}
          className="px-5 py-2.5 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-800 transition-colors shadow-sm shadow-violet-500/20"
        >
          Se connecter
        </button>
      </div>
    );
  }

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t) && tags.length < 10) {
      setTags([...tags, t]);
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => setTags(tags.filter((t) => t !== tag));

  const toggleCategory = (id: number) =>
    setSelectedCats((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!title.trim())   { setError('Le titre est obligatoire.'); return; }
    if (!content.trim()) { setError('Le contenu est obligatoire.'); return; }
    mutation.mutate();
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <button
        onClick={() => navigate(-1)}
        className="text-sm text-muted hover:text-text mb-6 flex items-center gap-1 transition-colors"
      >
        ← Retour
      </button>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text mb-1">Publier un tutoriel</h1>
        <p className="text-sm text-muted">Partage tes connaissances avec la communauté</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">

        {/* Titre */}
        <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm">
          <label className="block text-sm font-medium text-text mb-2">
            Titre <span className="text-danger">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex : Comment installer Docker sur Ubuntu 24.04"
            maxLength={255}
            className="w-full border border-border rounded-xl px-4 py-2.5 text-sm text-text bg-surface placeholder:text-muted/60 focus:outline-none focus:border-violet-600/50 focus:ring-3 focus:ring-brand/10 transition-all"
          />
          <p className="text-xs text-muted mt-1.5">{title.length}/255</p>
        </div>

        {/* Description */}
        <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm">
          <label className="block text-sm font-medium text-text mb-2">Description courte</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Résumé de ton tutoriel en 1-2 phrases..."
            rows={2}
            className="w-full border border-border rounded-xl px-4 py-2.5 text-sm text-text bg-surface placeholder:text-muted/60 focus:outline-none focus:border-violet-600/50 focus:ring-3 focus:ring-brand/10 transition-all resize-none"
          />
        </div>

        {/* Éditeur Markdown */}
        <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm">
          <label className="block text-sm font-medium text-text mb-3">
            Contenu <span className="text-danger">*</span>
          </label>
          <div data-color-mode="light">
            <MDEditor
              value={content}
              onChange={(val) => setContent(val ?? '')}
              height={480}
              preview="live"
              highlightEnable
              visibleDragbar={false}
              textareaProps={{
                placeholder: '# Introduction\n\nExplique ici ton tutoriel...\n\n## Étape 1\n\n```bash\nnpm install\n```',
              }}
            />
          </div>
        </div>

        {/* Difficulté + Durée */}
        <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm">
          <label className="block text-sm font-medium text-text mb-3">Difficulté & durée estimée</label>
          <div className="flex gap-3 flex-wrap">
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="flex-1 min-w-[160px] border border-border rounded-xl px-4 py-2.5 text-sm text-text bg-surface focus:outline-none focus:border-violet-600/50 focus:ring-3 focus:ring-brand/10 transition-all"
            >
              <option value="">Niveau (optionnel)</option>
              <option value="beginner">Débutant</option>
              <option value="intermediate">Intermédiaire</option>
              <option value="advanced">Avancé</option>
            </select>
            <input
              type="text"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="Durée ex: 15 min, 1h30..."
              className="flex-1 min-w-[160px] border border-border rounded-xl px-4 py-2.5 text-sm text-text bg-surface placeholder:text-muted/60 focus:outline-none focus:border-violet-600/50 focus:ring-3 focus:ring-brand/10 transition-all"
            />
          </div>
        </div>

        {/* Catégories */}
        <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm">
          <label className="block text-sm font-medium text-text mb-3">Catégories</label>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => toggleCategory(cat.id)}
                className={`px-3.5 py-1.5 rounded-full text-sm border transition-all ${
                  selectedCats.includes(cat.id)
                    ? 'bg-violet-600 text-white border-violet-600 shadow-sm shadow-violet-500/20'
                    : 'bg-surface2 text-muted border-border hover:border-violet-600/40 hover:text-text'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Tags */}
        <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm">
          <label className="block text-sm font-medium text-text mb-3">Tags</label>
          <div className="flex gap-2">
            <input
              ref={tagRef}
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
              placeholder="php, docker, linux... (Entrée pour valider)"
              className="flex-1 border border-border rounded-xl px-4 py-2.5 text-sm text-text bg-surface placeholder:text-muted/60 focus:outline-none focus:border-violet-600/50 focus:ring-3 focus:ring-brand/10 transition-all"
            />
            <button
              type="button"
              onClick={addTag}
              className="px-4 py-2.5 bg-surface2 hover:bg-border text-text rounded-xl text-sm border border-border transition-colors"
            >
              Ajouter
            </button>
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {tags.map((tag) => (
                <span key={tag} className="flex items-center gap-1 bg-violet-50 text-violet-600 border border-violet-600/20 px-2.5 py-1 rounded-full text-sm">
                  #{tag}
                  <button type="button" onClick={() => removeTag(tag)} className="hover:text-violet-800 ml-0.5 leading-none">×</button>
                </span>
              ))}
            </div>
          )}
          <p className="text-xs text-muted mt-2">{tags.length}/10 tags</p>
        </div>

        {/* Erreur */}
        {error && (
          <div className="bg-danger/8 border border-danger/20 text-danger text-sm rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        {/* Submit */}
        <div className="flex items-center gap-4 pt-1 pb-8">
          <button
            type="submit"
            disabled={mutation.isPending}
            className="px-6 py-2.5 bg-violet-600 hover:bg-violet-800 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors shadow-sm shadow-violet-500/20"
          >
            {mutation.isPending ? 'Publication...' : 'Publier le tutoriel'}
          </button>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="text-sm text-muted hover:text-text transition-colors"
          >
            Annuler
          </button>
        </div>
      </form>
    </div>
  );
}
