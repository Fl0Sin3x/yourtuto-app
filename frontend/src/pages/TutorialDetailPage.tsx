import { useState, useMemo, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tutorialsApi } from '../api/tutorials';
import { commentsApi } from '../api/comments';
import { useAuthStore } from '../store/authStore';
import MDEditor from '@uiw/react-md-editor';
import { StarRating } from '../components/StarRating';
import { apiClient } from '../api/client';
import type { Comment, Tutorial } from '../types';
import { TutorialCard } from '../components/tutorial/TutorialCard';
import { useFavoriteKeys, useToggleFavorite } from '../hooks/useFavorites';
import { useProgressKeys, useToggleProgress } from '../hooks/useProgress';
import { Seo } from '../seo/Seo';
import { absoluteUrl, truncate, tutorialPath } from '../seo/url';
import { AddToCollection } from '../components/collections/AddToCollection';
import { SummaryCard } from '../components/tutorial/SummaryCard';

// ── Recipe content parsing & scaling ──────────────────────────────────────────

function parseRecipeContent(content: string) {
  const servingsMatch = content.match(/\*\*Pour\s*:\*\*\s*(\d+)\s*pers/);
  const defaultServings = servingsMatch ? parseInt(servingsMatch[1]) : 4;

  const timeMatch = content.match(/\*\*Temps\s*:\*\*\s*([^|*\n]+)/);
  const time = timeMatch ? timeMatch[1].trim() : null;

  const ingSection = content.match(/##\s*Ingrédients\n+([\s\S]*?)(?=\n##|\n*$)/);
  const ingredients = ingSection
    ? ingSection[1].split('\n').filter(l => l.startsWith('- ')).map(l => l.slice(2).trim())
    : [];

  const stepsSection = content.match(/##\s*Préparation\n+([\s\S]*?)$/);
  const steps = stepsSection
    ? stepsSection[1].split('\n')
        .filter(l => /^\d+\.\s/.test(l))
        .map(l => l.replace(/^\d+\.\s*/, '').trim())
    : [];

  return { defaultServings, time, ingredients, steps };
}

function parseMeasure(text: string): { amount: number; unit: string; rest: string } | null {
  // Matches: "250g", "2 œufs", "1 c.c.", "100 ml", "1/2 c.s."
  const m = text.match(/^(\d+(?:[.,]\d+)?(?:\s*\/\s*\d+)?)\s*(g|kg|ml|cl|l|c\.c\.|c\.s\.|tasse|pincée|gousse|branche|feuille|tranche|morceau|cube|boîte|sachet|pincée)?\b(.*)/i);
  if (!m) return null;
  const rawNum = m[1].replace(',', '.').replace(/\s/g, '');
  const amount = rawNum.includes('/') ? (() => { const [n, d] = rawNum.split('/').map(Number); return n / d; })() : parseFloat(rawNum);
  if (isNaN(amount)) return null;
  return { amount, unit: m[2] ?? '', rest: m[3].trim() };
}

function scaleIngredient(ing: string, factor: number): string {
  if (factor === 1) return ing;
  const parsed = parseMeasure(ing);
  if (!parsed) return ing;
  const scaled = parsed.amount * factor;
  const fmt = scaled % 1 === 0 ? String(scaled) : Number(scaled.toFixed(1)).toString();
  return `${fmt}${parsed.unit}${parsed.rest ? ' ' + parsed.rest : ''}`;
}

// ── Bricolage content parsing ─────────────────────────────────────────────────

function parseBricolageTools(content: string): { required: string[]; optional: string[]; cleanContent: string } {
  const extractItems = (text: string) =>
    text.split('\n')
      .filter(l => l.trim().startsWith('- '))
      .map(l => l.replace(/^[\s-]+/, '').replace(/\*\*/g, '').trim())
      .filter(Boolean);

  let cleanContent = content;
  let required: string[] = [];
  let optional: string[] = [];

  const reqMatch = content.match(/##\s*Mat[ée]riel\s*(?:n[ée]cessaire|obligatoire|requis)?\s*\n+([\s\S]*?)(?=\n##|$)/i);
  if (reqMatch) {
    required = extractItems(reqMatch[1]);
    cleanContent = cleanContent.replace(reqMatch[0], '');
  }

  const optMatch = content.match(/##\s*Mat[ée]riel\s*(?:optionnel|recommand[ée])\s*\n+([\s\S]*?)(?=\n##|$)/i);
  if (optMatch) {
    optional = extractItems(optMatch[1]);
    cleanContent = cleanContent.replace(optMatch[0], '');
  }

  return { required, optional, cleanContent: cleanContent.trim() };
}

// ── Bricolage steps parsing ───────────────────────────────────────────────────

function parseBricolageSteps(content: string): { title: string; content: string }[] {
  // Split directly on "### Étape N" markers regardless of section structure
  const chunks = ('\n' + content).split(/\n(?=###\s*[ÉE]tape\s*\d)/i);
  return chunks
    .slice(1) // drop everything before first Étape
    .map(chunk => {
      const lines = chunk.split('\n');
      const titleLine = lines[0] ?? '';
      const title = titleLine.replace(/^###\s*[ÉE]tape\s*\d+\s*[:–-]?\s*/i, '').trim();
      // stop at next ## section if present
      const bodyLines: string[] = [];
      for (const line of lines.slice(1)) {
        if (/^##\s/.test(line)) break;
        bodyLines.push(line);
      }
      return { title, content: bodyLines.join('\n').trim() };
    })
    .filter(s => s.content);
}

// ── Dev steps parsing ─────────────────────────────────────────────────────────

function parseDevSteps(content: string): { title: string; content: string }[] {
  // Split on ## headings (top-level sections)
  const chunks = ('\n' + content).split(/\n(?=##\s)/);
  return chunks
    .slice(1)
    .map(chunk => {
      const lines = chunk.split('\n');
      const titleLine = lines[0] ?? '';
      const title = titleLine.replace(/^##\s+/, '').trim();
      return { title, content: lines.slice(1).join('\n').trim() };
    })
    .filter(s => s.title && s.content);
}

// ──────────────────────────────────────────────────────────────────────────────

export function TutorialDetailPage() {
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { isAuthenticated } = useAuthStore();
  const queryClient = useQueryClient();

  const tutorialId = Number(id);

  const { data: tutorial, isLoading, isError } = useQuery({
    queryKey: ['tutorial', id],
    queryFn: () => tutorialsApi.getOne(tutorialId),
    enabled: !!id,
  });

  const { data: comments = [] } = useQuery({
    queryKey: ['comments', tutorialId],
    queryFn: () => commentsApi.getByTutorial(tutorialId),
    enabled: !!id,
  });

  const [newComment, setNewComment]   = useState('');
  const [editingId, setEditingId]     = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');
  const { data: ratingData } = useQuery({
    queryKey: ['tutorial-rating', tutorialId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/api/tutorials/${tutorialId}/rating`);
      return data as { average: number; count: number; userRating: number | null };
    },
    enabled: !!id,
  });

  const rateMutation = useMutation({
    mutationFn: (rating: number) => apiClient.post<{ average: number; count: number; userRating: number }>(
      `/api/tutorials/${tutorialId}/rating`, { rating }
    ),
    onSuccess: ({ data }) => {
      queryClient.setQueryData(['tutorial-rating', tutorialId], data);
    },
  });

  // Optimistic: show the clicked value immediately while pending
  const displayedUserRating = rateMutation.isPending
    ? (rateMutation.variables ?? ratingData?.userRating ?? 0)
    : (ratingData?.userRating ?? 0);

  const addComment = useMutation({
    mutationFn: (content: string) => commentsApi.create(tutorialId, content),
    onSuccess: (newComment) => {
      setNewComment('');
      queryClient.setQueryData<Comment[]>(['comments', tutorialId], (old = []) => [newComment, ...old]);
    },
  });

  const deleteComment = useMutation({
    mutationFn: (commentId: number) => commentsApi.delete(commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', tutorialId] });
    },
  });

  const updateComment = useMutation({
    mutationFn: ({ id, content }: { id: number; content: string }) => commentsApi.update(id, content),
    onSuccess: () => {
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ['comments', tutorialId] });
    },
  });

  const handleSubmitComment = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newComment.trim();
    if (trimmed) addComment.mutate(trimmed);
  };

  const { data: favoriteKeys = [] } = useFavoriteKeys();
  const toggleFavorite = useToggleFavorite();
  const { data: progressKeys = [] } = useProgressKeys();
  const toggleProgress = useToggleProgress();

  // Track view — fire and forget on mount
  useEffect(() => {
    if (!id) return;
    apiClient.post(`/api/tutorials/${id}/view`).catch(() => {});
  }, [id]);

  // Related tutorials
  const { data: relatedTutorials = [] } = useQuery({
    queryKey: ['related', id],
    queryFn: async () => {
      const { data } = await apiClient.get<Tutorial[]>(`/api/tutorials/${id}/related`);
      return data;
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });

  // Recipe scaling — hooks must be before any early return
  const recipeData = useMemo(
    () => tutorial?.source === 'recipe' && tutorial.content ? parseRecipeContent(tutorial.content) : null,
    [tutorial?.source, tutorial?.content],
  );
  const [servings, setServings] = useState<number>(4);
  const [interactiveMode, setInteractiveMode] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState<'next' | 'prev'>('next');
  const [finished, setFinished] = useState(false);
  const [interactiveTotalSteps, setInteractiveTotalSteps] = useState(0);
  const touchStartX = useRef(0);

  // Persist step progress to localStorage while in interactive mode
  useEffect(() => {
    if (!interactiveMode || !tutorial?.id || interactiveTotalSteps === 0) return;
    const key = `ytuto_step_${tutorial.id}_${tutorial.source}`;
    localStorage.setItem(key, JSON.stringify({ step: currentStep, total: interactiveTotalSteps }));
  }, [currentStep, interactiveMode, interactiveTotalSteps, tutorial?.id, tutorial?.source]);

  const bricolageData = useMemo(
    () => tutorial?.source === 'generated' && tutorial.content ? parseBricolageTools(tutorial.content) : null,
    [tutorial?.source, tutorial?.content],
  );
  const bricolageSteps = useMemo(
    () => bricolageData ? parseBricolageSteps(bricolageData.cleanContent) : [],
    [bricolageData],
  );
  const devSteps = useMemo(
    () => tutorial?.source === 'community' && tutorial.content ? parseDevSteps(tutorial.content) : [],
    [tutorial?.source, tutorial?.content],
  );

  // Terminal typewriter state
  const [termTyped, setTermTyped]           = useState(0);
  const [termShowContent, setTermShowContent] = useState(false);
  const termTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Restart typewriter when entering a new terminal step
  useEffect(() => {
    if (!interactiveMode || tutorial?.source !== 'community') return;
    setTermTyped(0);
    setTermShowContent(false);
    if (termTimerRef.current) clearInterval(termTimerRef.current);
    const cmd = devSteps[currentStep]?.title ?? '';
    let i = 0;
    termTimerRef.current = setInterval(() => {
      i++;
      setTermTyped(i);
      if (i >= cmd.length) {
        clearInterval(termTimerRef.current!);
        termTimerRef.current = null;
        setTimeout(() => setTermShowContent(true), 250);
      }
    }, 38);
    return () => { if (termTimerRef.current) clearInterval(termTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, interactiveMode]);

  // Keyboard navigation for terminal mode
  useEffect(() => {
    if (!interactiveMode || tutorial?.source !== 'community') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' && currentStep < devSteps.length - 1) {
        setDirection('next'); setCurrentStep(s => s + 1);
      } else if (e.key === 'ArrowLeft' && currentStep > 0) {
        setDirection('prev'); setCurrentStep(s => s - 1);
      } else if (e.key === 'Escape') {
        setInteractiveMode(false); setCurrentStep(0);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interactiveMode, currentStep, devSteps.length]);

  if (isLoading) {
    return (
      <div className="flex justify-center mt-20">
        <div className="w-8 h-8 border-3 border-violet-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isError || !tutorial) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <p className="text-danger font-semibold mb-2">Tutoriel introuvable</p>
        <button onClick={() => navigate(-1)} className="text-sm text-violet-600 hover:text-violet-800 transition-colors">
          ← Retour
        </button>
      </div>
    );
  }

  const isAuthor = user?.id === tutorial.author?.id;
  const isGenerated = tutorial.source === 'generated';

  const tutorialSlug = String(tutorial.id);
  const favKey  = `${tutorialSlug}|${tutorial.source}`;
  const isSaved = favoriteKeys.includes(favKey);
  const isDone  = progressKeys.includes(favKey);

  const ActionButtons = ({ light = false }: { light?: boolean }) => !isAuthenticated() ? null : (
    <div className="flex items-center gap-2 shrink-0">
      <button
        onClick={() => toggleFavorite.mutate({ slug: tutorialSlug, source: tutorial.source, title: tutorial.title, thumbnailUrl: tutorial.thumbnailUrl, externalUrl: tutorial.externalUrl })}
        disabled={toggleFavorite.isPending}
        title={isSaved ? 'Retirer des favoris' : 'Ajouter aux favoris'}
        className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all ${
          light
            ? isSaved ? 'bg-amber-300/20 border-amber-200/50 text-amber-100' : 'bg-white/10 border-white/20 text-white/80 hover:bg-white/20'
            : isSaved ? 'bg-amber-50 border-amber-300 text-amber-600 hover:bg-amber-100' : 'bg-white border-zinc-200 text-zinc-500 hover:border-amber-300 hover:text-amber-600'
        }`}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill={isSaved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>
        </svg>
        {isSaved ? 'Sauvegardé' : 'Sauvegarder'}
      </button>
      <button
        onClick={() => toggleProgress.mutate({ slug: tutorialSlug, source: tutorial.source, title: tutorial.title, thumbnailUrl: tutorial.thumbnailUrl, externalUrl: tutorial.externalUrl })}
        disabled={toggleProgress.isPending}
        title={isDone ? 'Retirer de mon parcours' : 'Ajouter à mon parcours'}
        className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all ${
          light
            ? isDone ? 'bg-violet-300/20 border-violet-200/50 text-violet-100' : 'bg-white/10 border-white/20 text-white/80 hover:bg-white/20'
            : isDone ? 'bg-violet-50 border-violet-300 text-violet-600 hover:bg-violet-100' : 'bg-white border-zinc-200 text-zinc-500 hover:border-violet-300 hover:text-violet-600'
        }`}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill={isDone ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
          <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/>
        </svg>
        {isDone ? 'Dans mon parcours' : 'Mon parcours'}
      </button>
    </div>
  );
  const isRecipe = tutorial.source === 'recipe';

  // Helper: start interactive mode with auto-parcours + localStorage resume
  const startInteractive = (totalSteps: number) => {
    const lsKey = `ytuto_step_${tutorialSlug}_${tutorial.source}`;
    const saved = localStorage.getItem(lsKey);
    let resumeStep = 0;
    if (saved) {
      try {
        const { step, total } = JSON.parse(saved) as { step: number; total: number };
        if (total === totalSteps && step > 0 && step < totalSteps) resumeStep = step;
      } catch { /* ignore */ }
    }
    if (isAuthenticated() && !isDone) toggleProgress.mutate({ slug: tutorialSlug, source: tutorial.source, title: tutorial.title, thumbnailUrl: tutorial.thumbnailUrl, externalUrl: tutorial.externalUrl });
    setInteractiveTotalSteps(totalSteps);
    setCurrentStep(resumeStep);
    setDirection('next');
    setInteractiveMode(true);
  };

  // Helper: finish interactive mode — clear localStorage + celebrate
  const finishInteractive = () => {
    const lsKey = `ytuto_step_${tutorialSlug}_${tutorial.source}`;
    localStorage.removeItem(lsKey);
    setFinished(true);
    setTimeout(() => { setFinished(false); setInteractiveMode(false); setCurrentStep(0); setInteractiveTotalSteps(0); }, 3500);
  };

  const recipeServings  = recipeData?.defaultServings ?? 4; // actual yield from recipe content
  const scaleFactor     = servings / recipeServings;

  const SOURCE_LABELS: Record<string, string> = {
    community: 'Communauté', youtube: 'YouTube', devto: 'DEV.to',
    reddit: 'Reddit', medium: 'Medium', recipe: '🍳 Recette',
    instructables: '🔧 DIY', generated: '🔧 Bricolage',
  };

  const seoTags = (
    <Seo
      title={tutorial.title}
      description={tutorial.description || tutorial.content || 'Tutoriel YourTuto'}
      canonical={tutorialPath(tutorial)}
      image={tutorial.thumbnailUrl}
      type="article"
      noindex={!tutorial.published}
      jsonLd={[{
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: tutorial.title.slice(0, 110),
        description: truncate(tutorial.description || tutorial.content || '', 160),
        image: [absoluteUrl(tutorial.thumbnailUrl || '/Yourtuto.jpg')],
        url: absoluteUrl(tutorialPath(tutorial)),
        inLanguage: 'fr',
        datePublished: tutorial.createdAt,
        dateModified: tutorial.updatedAt ?? tutorial.createdAt,
        ...(tutorial.author ? { author: { '@type': 'Person', name: tutorial.author.username } } : {}),
      }]}
    />
  );

  if (isRecipe) {
    const recipeSteps = recipeData ? [
      { label: 'Ingrédients', type: 'ingredients' as const },
      ...recipeData.steps.map((s, i) => ({ label: `Étape ${i + 1}`, type: 'step' as const, content: s })),
    ] : [];

    if (interactiveMode && recipeSteps.length > 0) {
      const step = recipeSteps[currentStep];
      const isFirst = currentStep === 0;
      const isLast  = currentStep === recipeSteps.length - 1;

      const goNext = () => { setDirection('next'); setCurrentStep(s => s + 1); };
      const goPrev = () => { setDirection('prev'); setCurrentStep(s => s - 1); };
      const handleFinish = finishInteractive;

      return (
        <div
          className="min-h-screen bg-white flex flex-col"
          onTouchStart={e => { touchStartX.current = e.touches[0].clientX; }}
          onTouchEnd={e => {
            const diff = touchStartX.current - e.changedTouches[0].clientX;
            if (Math.abs(diff) > 50) { if (diff > 0 && !isLast) goNext(); else if (diff < 0 && !isFirst) goPrev(); }
          }}
        >
          {seoTags}
          {/* Header */}
          <div className="bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 text-white">
            <div className="max-w-2xl mx-auto px-5 pt-6 pb-6">
              <div className="flex items-center justify-between mb-4">
                <button onClick={() => navigate(-1)} className="text-amber-100 hover:text-white text-sm flex items-center gap-1 transition-colors">← Retour</button>
                <button onClick={() => { setInteractiveMode(false); setCurrentStep(0); }} className="text-xs bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-full transition-colors">Vue complète ↗</button>
              </div>
              <h1 className="text-lg font-bold leading-snug mb-3">{tutorial.title}</h1>
              <div className="bg-white/20 rounded-full h-1.5 mb-3">
                <div className="bg-white rounded-full h-1.5 transition-all duration-500 ease-out" style={{ width: `${((currentStep + 1) / recipeSteps.length) * 100}%` }} />
              </div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-semibold text-amber-100">{step.label}</span>
                <div className="flex gap-1.5">
                  {recipeSteps.map((_, i) => (
                    <button key={i} onClick={() => { setDirection(i > currentStep ? 'next' : 'prev'); setCurrentStep(i); }}
                      className={`rounded-full transition-all duration-300 ${i === currentStep ? 'w-5 h-2 bg-white' : 'w-2 h-2 bg-white/35 hover:bg-white/60'}`} />
                  ))}
                </div>
              </div>
              <div className={`flex gap-3 ${finished ? 'animate-celebrate' : ''}`}>
                <button onClick={goPrev} disabled={isFirst}
                  className="flex-1 py-2.5 rounded-xl bg-white/15 border border-white/30 text-white text-sm font-medium hover:bg-white/25 active:scale-95 transition-all disabled:opacity-30">
                  ← Précédent
                </button>
                <button onClick={() => { if (isLast) handleFinish(); else goNext(); }}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold active:scale-95 transition-all ${isLast ? 'bg-emerald-400 hover:bg-emerald-300 text-white shadow-lg' : 'bg-white text-amber-600 hover:bg-amber-50'}`}>
                  {isLast ? '✓ Terminer' : 'Suivant →'}
                </button>
              </div>
            </div>
          </div>

          {/* Step content — animated */}
          <div className="max-w-2xl mx-auto w-full px-5 py-8">
            <div key={currentStep} className={direction === 'next' ? 'animate-slide-in-right' : 'animate-slide-in-left'}>
              {step.type === 'ingredients' ? (
                <>
                  <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                    <h2 className="text-xl font-bold text-zinc-900">
                      Ingrédients <span className="text-sm font-normal text-zinc-400">({recipeData!.ingredients.length})</span>
                    </h2>
                    <div className="flex items-center gap-2.5 bg-amber-50 border border-amber-200/60 rounded-xl px-3 py-1.5">
                      <span className="text-xs text-amber-700 font-medium whitespace-nowrap">🍽 Personnes</span>
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => setServings(s => Math.max(1, s - 1))} disabled={servings <= 1} className="w-6 h-6 rounded-lg bg-white border border-amber-200 text-amber-700 font-bold text-sm flex items-center justify-center hover:bg-amber-100 transition-colors disabled:opacity-40">−</button>
                        <span className="w-6 text-center text-sm font-bold text-amber-800">{servings}</span>
                        <button onClick={() => setServings(s => Math.min(50, s + 1))} disabled={servings >= 50} className="w-6 h-6 rounded-lg bg-white border border-amber-200 text-amber-700 font-bold text-sm flex items-center justify-center hover:bg-amber-100 transition-colors disabled:opacity-40">+</button>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {recipeData!.ingredients.map((ing, i) => (
                      <div key={i} className="animate-pop-in flex items-center gap-3 bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-3" style={{ animationDelay: `${i * 35}ms` }}>
                        <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                        <span className="text-sm text-zinc-800 leading-snug font-medium">{scaleIngredient(ing, scaleFactor)}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-100 text-amber-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
                    <span className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px] font-bold">{currentStep}</span>
                    {step.label}
                  </div>
                  <p className="text-base text-zinc-700 leading-relaxed">{step.content}</p>
                </>
              )}
            </div>
          </div>

          {/* Finish overlay */}
          {finished && (
            <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/70 animate-fade-in">
              <img src="/done-and-done-spongebob.gif" alt="Bravo !" className="w-64 rounded-2xl shadow-2xl animate-pop-in" />
              <p className="mt-5 text-white text-2xl font-bold animate-slide-up">Bravo ! 🎉</p>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-white">
        {seoTags}

        {/* Hero */}
        <div className="bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 text-white">
          <div className="max-w-4xl mx-auto px-5 pt-8 pb-12">
            <button onClick={() => navigate(-1)} className="text-amber-100 hover:text-white text-sm flex items-center gap-1 mb-8 transition-colors">
              ← Retour
            </button>
            <div className="flex items-start gap-5">
              <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center shrink-0 text-2xl">
                🍳
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  {tutorial.categories.map((cat) => (
                    <span key={cat.id} className="text-xs px-2.5 py-1 rounded-full bg-white/15 text-amber-50">
                      {cat.name}
                    </span>
                  ))}
                  {tutorial.tags.slice(0, 3).map((tag) => (
                    <span key={tag.id} className="text-xs px-2.5 py-1 rounded-full bg-white/10 text-amber-100">
                      #{tag.name}
                    </span>
                  ))}
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold leading-snug mb-3">{tutorial.title}</h1>
                {tutorial.description && (
                  <p className="text-amber-100 text-sm leading-relaxed max-w-2xl">{tutorial.description}</p>
                )}
              </div>
            </div>

            {/* Meta bar */}
            <div className="mt-8 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-6 text-sm text-amber-200 flex-wrap">
                <div className="flex items-center gap-2">
                  <StarRating value={ratingData?.average ?? 0} readonly size="sm" />
                  <span className="text-white font-semibold">{ratingData?.average ?? 0}</span>
                  <span className="text-amber-300">({ratingData?.count ?? 0} avis)</span>
                </div>
                {isAuthenticated() && (
                  <div className="flex items-center gap-2">
                    <span className="text-amber-300 text-xs">Ta note :</span>
                    <StarRating value={displayedUserRating} onChange={(v) => rateMutation.mutate(v)} />
                    {ratingData?.userRating && <span className="text-xs text-amber-200 font-medium">✓</span>}
                  </div>
                )}
                <span>{new Date(tutorial.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              </div>
              <div className="flex items-center gap-2">
                {recipeSteps.length > 1 && (
                  <button onClick={() => startInteractive(recipeSteps.length)}
                    className="flex items-center gap-1.5 text-xs font-semibold bg-white text-amber-600 hover:bg-amber-50 px-3 py-1.5 rounded-lg transition-colors shadow-sm">
                    ▶ Mode interactif
                  </button>
                )}
                <ActionButtons light />
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-4xl mx-auto px-5 py-10">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-10 items-start">

            {/* Main */}
            <div>
              {recipeData ? (
                <>
                  {/* Ingrédients */}
                  <section className="mb-8">
                    <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                      <h2 className="text-base font-bold text-zinc-900">
                        Ingrédients
                        <span className="ml-2 text-xs font-normal text-zinc-400">({recipeData.ingredients.length})</span>
                      </h2>
                      {/* Servings adjuster */}
                      <div className="flex items-center gap-2.5 bg-amber-50 border border-amber-200/60 rounded-xl px-3 py-1.5">
                        <span className="text-xs text-amber-700 font-medium whitespace-nowrap">🍽 Personnes</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setServings(s => Math.max(1, s - 1))}
                            disabled={servings <= 1}
                            className="w-6 h-6 rounded-lg bg-white border border-amber-200 text-amber-700 font-bold text-sm flex items-center justify-center hover:bg-amber-100 transition-colors disabled:opacity-40"
                          >−</button>
                          <span className="w-6 text-center text-sm font-bold text-amber-800">{servings}</span>
                          <button
                            onClick={() => setServings(s => Math.min(50, s + 1))}
                            disabled={servings >= 50}
                            className="w-6 h-6 rounded-lg bg-white border border-amber-200 text-amber-700 font-bold text-sm flex items-center justify-center hover:bg-amber-100 transition-colors disabled:opacity-40"
                          >+</button>
                        </div>
                        {servings !== 4 && (
                          <button
                            onClick={() => setServings(4)}
                            className="text-xs text-amber-500 hover:text-amber-700 transition-colors ml-1"
                            title="Remettre à 4 personnes"
                          >↺</button>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {recipeData.ingredients.map((ing, i) => (
                        <div key={i} className="flex items-center gap-3 bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-3">
                          <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                          <span className="text-sm text-zinc-800 leading-snug font-medium">{scaleIngredient(ing, scaleFactor)}</span>
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* Étapes */}
                  {recipeData.steps.length > 0 && (
                    <section>
                      <h2 className="text-base font-bold text-zinc-900 mb-4">
                        Préparation
                        <span className="ml-2 text-xs font-normal text-zinc-400">({recipeData.steps.length} étapes)</span>
                      </h2>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {recipeData.steps.map((step, i) => (
                          <div key={i} className="flex gap-3">
                            <div className="shrink-0 w-7 h-7 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center">
                              <span className="text-xs font-bold text-amber-600">{i + 1}</span>
                            </div>
                            <p className="text-sm text-zinc-700 leading-relaxed pt-0.5">{step}</p>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </>
              ) : (
                <div data-color-mode="light">
                  <MDEditor.Markdown source={tutorial.content ?? ''} style={{ background: 'transparent', color: 'inherit' }} />
                </div>
              )}
            </div>

            {/* Sidebar */}
            <aside className="space-y-4 lg:sticky lg:top-6">
              {recipeData?.time && (
                <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex items-center gap-3">
                  <span className="text-xl">⏱</span>
                  <div>
                    <p className="text-xs text-amber-600 font-semibold uppercase tracking-wider">Temps</p>
                    <p className="text-sm font-bold text-zinc-900">{recipeData.time}</p>
                  </div>
                </div>
              )}
              {tutorial.tags.length > 0 && (
                <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
                  <h3 className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-3">Tags</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {tutorial.tags.map((tag) => (
                      <span key={tag.id} className="text-xs bg-white border border-amber-200 text-amber-700 px-2.5 py-1 rounded-full">
                        #{tag.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {tutorial.categories.length > 0 && (
                <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4">
                  <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Catégorie</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {tutorial.categories.map((cat) => (
                      <span key={cat.id} className="text-xs bg-white border border-zinc-200 text-zinc-600 px-2.5 py-1 rounded-full">
                        {cat.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </aside>
          </div>
        </div>

        {/* Related tutorials */}
        {relatedTutorials.length > 0 && (
          <div className="max-w-4xl mx-auto px-5 pb-10">
            <div className="border-t border-zinc-100 pt-10">
              <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-5">Dans le même genre</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {relatedTutorials.map((t) => <TutorialCard key={t.id} tutorial={t} />)}
              </div>
            </div>
          </div>
        )}

        {/* Comments */}
        <div className="max-w-4xl mx-auto px-5 pb-16">
          <div className="border-t border-zinc-100 pt-10">
            <h2 className="text-lg font-bold text-zinc-900 mb-6">
              Commentaires {comments.length > 0 && <span className="text-zinc-400 font-normal text-sm ml-1">({comments.length})</span>}
            </h2>
            {isAuthenticated() ? (
              <form onSubmit={handleSubmitComment} className="mb-8">
                <div data-color-mode="light" className="rounded-xl overflow-hidden border border-zinc-200">
                  <MDEditor value={newComment} onChange={(v) => setNewComment(v ?? '')} preview="edit" height={160}
                    textareaProps={{ maxLength: 2000, placeholder: 'Ajouter un commentaire...' }} style={{ borderRadius: 0 }} />
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-zinc-400">{newComment.length}/2000</span>
                  <button type="submit" disabled={!newComment.trim() || addComment.isPending}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-xl disabled:opacity-40 transition-colors">
                    {addComment.isPending ? 'Envoi...' : 'Commenter'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="mb-8 text-center py-6 bg-zinc-50 rounded-xl border border-zinc-100">
                <p className="text-sm text-zinc-500">
                  <Link to="/login" className="text-amber-600 hover:text-amber-800 font-medium">Connecte-toi</Link> pour laisser un commentaire.
                </p>
              </div>
            )}
            {comments.length === 0 ? (
              <p className="text-sm text-zinc-400 text-center py-6">Aucun commentaire pour le moment. Sois le premier !</p>
            ) : (
              <div className="space-y-4">
                {comments.map((comment: Comment) => (
                  <div key={comment.id} className="flex gap-3 p-4 rounded-xl bg-zinc-50/60 border border-zinc-100">
                    <div className="w-8 h-8 rounded-full shrink-0 overflow-hidden bg-amber-50 border border-amber-200/60">
                      {comment.author?.profilePicture ? (
                        <img src={`/uploads/avatars/${comment.author.profilePicture}`} alt={comment.author.username} className="w-full h-full object-cover" />
                      ) : comment.author?.avatar ? (
                        <img src={comment.author.avatar} alt={comment.author.username} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-amber-600 text-xs font-bold">
                          {comment.author?.username?.slice(0, 2).toUpperCase() ?? '?'}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-zinc-900">@{comment.author?.username ?? 'Inconnu'}</span>
                        <span className="text-xs text-zinc-400">{new Date(comment.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        {user?.id === comment.author?.id && (
                          <div className="ml-auto flex items-center gap-2">
                            <button onClick={() => { setEditingId(comment.id); setEditContent(comment.content); }} className="text-xs text-zinc-400 hover:text-amber-600 transition-colors">Modifier</button>
                            <button onClick={() => deleteComment.mutate(comment.id)} disabled={deleteComment.isPending} className="text-xs text-zinc-400 hover:text-red-500 transition-colors">×</button>
                          </div>
                        )}
                      </div>
                      {editingId === comment.id ? (
                        <div data-color-mode="light">
                          <div className="rounded-xl overflow-hidden border border-zinc-200 mb-2">
                            <MDEditor value={editContent} onChange={(v) => setEditContent(v ?? '')} preview="edit" height={120} textareaProps={{ maxLength: 2000 }} />
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => updateComment.mutate({ id: comment.id, content: editContent })} disabled={!editContent.trim() || updateComment.isPending}
                              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg disabled:opacity-40 transition-colors">
                              {updateComment.isPending ? 'Enregistrement...' : 'Enregistrer'}
                            </button>
                            <button onClick={() => setEditingId(null)} className="px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-900 border border-zinc-200 rounded-lg transition-colors">Annuler</button>
                          </div>
                        </div>
                      ) : (
                        <div data-color-mode="light" className="text-sm">
                          <MDEditor.Markdown source={comment.content} style={{ background: 'transparent', color: 'inherit', fontSize: '0.875rem' }} />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (isGenerated) {
    const bricolageTools = bricolageData;
    const bSteps = [
      ...(bricolageTools && (bricolageTools.required.length > 0 || bricolageTools.optional.length > 0)
        ? [{ label: 'Matériel', type: 'tools' as const }] : []),
      ...bricolageSteps.map((s, i) => ({ label: `Étape ${i + 1}${s.title ? ` — ${s.title}` : ''}`, type: 'step' as const, content: s.content })),
    ];

    if (interactiveMode && bSteps.length > 0) {
      const step = bSteps[currentStep];
      const isFirst = currentStep === 0;
      const isLast  = currentStep === bSteps.length - 1;

      const goNext = () => { setDirection('next'); setCurrentStep(s => s + 1); };
      const goPrev = () => { setDirection('prev'); setCurrentStep(s => s - 1); };
      const handleFinish = finishInteractive;

      return (
        <div
          className="min-h-screen bg-white flex flex-col"
          onTouchStart={e => { touchStartX.current = e.touches[0].clientX; }}
          onTouchEnd={e => {
            const diff = touchStartX.current - e.changedTouches[0].clientX;
            if (Math.abs(diff) > 50) { if (diff > 0 && !isLast) goNext(); else if (diff < 0 && !isFirst) goPrev(); }
          }}
        >
          {seoTags}
          {/* Header */}
          <div className="bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 text-white">
            <div className="max-w-2xl mx-auto px-5 pt-6 pb-6">
              <div className="flex items-center justify-between mb-4">
                <button onClick={() => navigate(-1)} className="text-violet-200 hover:text-white text-sm flex items-center gap-1 transition-colors">← Retour</button>
                <button onClick={() => { setInteractiveMode(false); setCurrentStep(0); }} className="text-xs bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-full transition-colors">Vue complète ↗</button>
              </div>
              <h1 className="text-lg font-bold leading-snug mb-3">{tutorial.title}</h1>
              <div className="bg-white/20 rounded-full h-1.5 mb-3">
                <div className="bg-white rounded-full h-1.5 transition-all duration-500 ease-out" style={{ width: `${((currentStep + 1) / bSteps.length) * 100}%` }} />
              </div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-semibold text-violet-100 truncate max-w-[70%]">{step.label}</span>
                <div className="flex gap-1.5 shrink-0">
                  {bSteps.map((_, i) => (
                    <button key={i} onClick={() => { setDirection(i > currentStep ? 'next' : 'prev'); setCurrentStep(i); }}
                      className={`rounded-full transition-all duration-300 ${i === currentStep ? 'w-5 h-2 bg-white' : 'w-2 h-2 bg-white/35 hover:bg-white/60'}`} />
                  ))}
                </div>
              </div>
              <div className={`flex gap-3 ${finished ? 'animate-celebrate' : ''}`}>
                <button onClick={goPrev} disabled={isFirst}
                  className="flex-1 py-2.5 rounded-xl bg-white/15 border border-white/30 text-white text-sm font-medium hover:bg-white/25 active:scale-95 transition-all disabled:opacity-30">
                  ← Précédent
                </button>
                <button onClick={() => { if (isLast) handleFinish(); else goNext(); }}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold active:scale-95 transition-all ${isLast ? 'bg-emerald-400 hover:bg-emerald-300 text-white shadow-lg' : 'bg-white text-violet-700 hover:bg-violet-50'}`}>
                  {isLast ? '✓ Terminer' : 'Suivant →'}
                </button>
              </div>
            </div>
          </div>

          {/* Step content — animated */}
          <div className="max-w-2xl mx-auto w-full px-5 py-8">
            <div key={currentStep} className={direction === 'next' ? 'animate-slide-in-right' : 'animate-slide-in-left'}>
              {step.type === 'tools' && bricolageTools ? (
                <div className="space-y-6">
                  {bricolageTools.required.length > 0 && (
                    <section>
                      <h2 className="text-xl font-bold text-zinc-900 mb-4">
                        Matériel nécessaire <span className="text-sm font-normal text-zinc-400">({bricolageTools.required.length})</span>
                      </h2>
                      <div className="grid grid-cols-2 gap-2">
                        {bricolageTools.required.map((tool, i) => (
                          <div key={i} className="animate-pop-in flex items-center gap-3 bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-3" style={{ animationDelay: `${i * 35}ms` }}>
                            <span className="w-2 h-2 rounded-full bg-violet-500 shrink-0" />
                            <span className="text-sm text-zinc-800 leading-snug font-medium">{tool}</span>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                  {bricolageTools.optional.length > 0 && (
                    <section>
                      <h2 className="text-xl font-bold text-zinc-900 mb-4">
                        Matériel optionnel <span className="text-sm font-normal text-zinc-400">({bricolageTools.optional.length})</span>
                      </h2>
                      <div className="grid grid-cols-2 gap-2">
                        {bricolageTools.optional.map((tool, i) => (
                          <div key={i} className="animate-pop-in flex items-center gap-3 bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-3" style={{ animationDelay: `${i * 35}ms` }}>
                            <span className="w-2 h-2 rounded-full bg-zinc-300 shrink-0" />
                            <span className="text-sm text-zinc-600 leading-snug">{tool}</span>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </div>
              ) : (
                <div>
                  <div className="inline-flex items-center gap-2 bg-violet-50 border border-violet-100 text-violet-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
                    <span className="w-5 h-5 rounded-full bg-violet-600 text-white flex items-center justify-center text-[10px] font-bold">{currentStep}</span>
                    {step.label}
                  </div>
                  <div data-color-mode="light" className="prose prose-zinc max-w-none prose-p:leading-relaxed">
                    <MDEditor.Markdown source={step.type === 'step' ? step.content : ''} style={{ background: 'transparent', color: 'inherit' }} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Finish overlay */}
          {finished && (
            <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/70 animate-fade-in">
              <img src="/done-and-done-spongebob.gif" alt="Bravo !" className="w-64 rounded-2xl shadow-2xl animate-pop-in" />
              <p className="mt-5 text-white text-2xl font-bold animate-slide-up">Bravo ! 🎉</p>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-white">
        {seoTags}

        {/* Hero */}
        <div className="bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 text-white">
          <div className="max-w-4xl mx-auto px-5 pt-8 pb-12">
            <button onClick={() => navigate(-1)} className="text-violet-200 hover:text-white text-sm flex items-center gap-1 mb-8 transition-colors">
              ← Retour
            </button>
            <div className="flex items-start gap-5">
              <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center shrink-0 text-2xl">
                🔧
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  {tutorial.tags.slice(0, 3).map((tag) => (
                    <span key={tag.id} className="text-xs px-2.5 py-1 rounded-full bg-white/10 text-violet-100">
                      #{tag.name}
                    </span>
                  ))}
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold leading-snug mb-3">{tutorial.title}</h1>
                {tutorial.description && (
                  <p className="text-violet-100 text-sm leading-relaxed max-w-2xl">{tutorial.description}</p>
                )}
              </div>
            </div>

            {/* Meta bar */}
            <div className="mt-8 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-6 text-sm text-violet-200 flex-wrap">
                <div className="flex items-center gap-2">
                  <StarRating value={ratingData?.average ?? 0} readonly size="sm" />
                  <span className="text-white font-semibold">{ratingData?.average ?? 0}</span>
                  <span className="text-violet-300">({ratingData?.count ?? 0} avis)</span>
                </div>
                {isAuthenticated() && (
                  <div className="flex items-center gap-2">
                    <span className="text-violet-300 text-xs">Ta note :</span>
                    <StarRating value={displayedUserRating} onChange={(v) => rateMutation.mutate(v)} />
                    {ratingData?.userRating && <span className="text-xs text-violet-200 font-medium">✓</span>}
                  </div>
                )}
                <span>{new Date(tutorial.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              </div>
              <div className="flex items-center gap-2">
                {bSteps.length > 0 && (
                  <button onClick={() => startInteractive(bSteps.length)}
                    className="flex items-center gap-1.5 text-xs font-semibold bg-white text-violet-600 hover:bg-violet-50 px-3 py-1.5 rounded-lg transition-colors shadow-sm">
                    ▶ Mode interactif
                  </button>
                )}
                <ActionButtons light />
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-4xl mx-auto px-5 py-10">

          {/* Outils */}
          {bricolageTools && (bricolageTools.required.length > 0 || bricolageTools.optional.length > 0) && (
            <div className="mb-10 space-y-6">
              {bricolageTools.required.length > 0 && (
                <section>
                  <h2 className="text-base font-bold text-zinc-900 mb-4">
                    Matériel nécessaire
                    <span className="ml-2 text-xs font-normal text-zinc-400">({bricolageTools.required.length})</span>
                  </h2>
                  <div className="grid grid-cols-2 gap-2">
                    {bricolageTools.required.map((tool, i) => (
                      <div key={i} className="flex items-center gap-3 bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-3">
                        <span className="w-2 h-2 rounded-full bg-violet-500 shrink-0" />
                        <span className="text-sm text-zinc-800 leading-snug font-medium">{tool}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}
              {bricolageTools.optional.length > 0 && (
                <section>
                  <h2 className="text-base font-bold text-zinc-900 mb-4">
                    Matériel optionnel
                    <span className="ml-2 text-xs font-normal text-zinc-400">({bricolageTools.optional.length})</span>
                  </h2>
                  <div className="grid grid-cols-2 gap-2">
                    {bricolageTools.optional.map((tool, i) => (
                      <div key={i} className="flex items-center gap-3 bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-3">
                        <span className="w-2 h-2 rounded-full bg-zinc-300 shrink-0" />
                        <span className="text-sm text-zinc-600 leading-snug">{tool}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-10 items-start">

            {/* Main */}
            <div className="prose prose-zinc prose-headings:font-bold prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-3 prose-h3:text-base prose-h3:mt-5 prose-h3:mb-2 prose-li:my-0.5 prose-p:leading-relaxed max-w-none">
              {tutorial.content ? (
                <div data-color-mode="light">
                  <MDEditor.Markdown source={bricolageTools?.cleanContent ?? tutorial.content} style={{ background: 'transparent', color: 'inherit' }} />
                </div>
              ) : (
                <p className="text-muted text-sm">Aucun contenu disponible.</p>
              )}
            </div>

            {/* Sidebar */}
            <aside className="space-y-4 lg:sticky lg:top-6">
              {tutorial.tags.length > 0 && (
                <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4">
                  <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Tags</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {tutorial.tags.map((tag) => (
                      <span key={tag.id} className="text-xs bg-white border border-zinc-200 text-zinc-600 px-2.5 py-1 rounded-full">
                        #{tag.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </aside>
          </div>
        </div>

        {/* Related tutorials */}
        {relatedTutorials.length > 0 && (
          <div className="max-w-4xl mx-auto px-5 pb-10">
            <div className="border-t border-zinc-100 pt-10">
              <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-5">Dans le même genre</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {relatedTutorials.map((t) => <TutorialCard key={t.id} tutorial={t} />)}
              </div>
            </div>
          </div>
        )}

        {/* Comments */}
        <div className="max-w-4xl mx-auto px-5 pb-16">
          <div className="border-t border-zinc-100 pt-10">
            <h2 className="text-lg font-bold text-zinc-900 mb-6">
              Commentaires {comments.length > 0 && <span className="text-zinc-400 font-normal text-sm ml-1">({comments.length})</span>}
            </h2>
            {isAuthenticated() ? (
              <form onSubmit={handleSubmitComment} className="mb-8">
                <div data-color-mode="light" className="rounded-xl overflow-hidden border border-zinc-200">
                  <MDEditor value={newComment} onChange={(v) => setNewComment(v ?? '')} preview="edit" height={160}
                    textareaProps={{ maxLength: 2000, placeholder: 'Ajouter un commentaire...' }} style={{ borderRadius: 0 }} />
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-zinc-400">{newComment.length}/2000</span>
                  <button type="submit" disabled={!newComment.trim() || addComment.isPending}
                    className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-xl disabled:opacity-40 transition-colors">
                    {addComment.isPending ? 'Envoi...' : 'Commenter'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="mb-8 text-center py-6 bg-zinc-50 rounded-xl border border-zinc-200">
                <p className="text-sm text-zinc-500">
                  <Link to="/login" className="text-violet-600 hover:text-violet-800 font-medium">Connecte-toi</Link> pour laisser un commentaire.
                </p>
              </div>
            )}
            {comments.length === 0 ? (
              <p className="text-sm text-zinc-400 text-center py-6">Aucun commentaire pour le moment.</p>
            ) : (
              <div className="space-y-4">
                {comments.map((comment: Comment) => (
                  <div key={comment.id} className="flex gap-3 p-4 rounded-xl bg-zinc-50/60 border border-zinc-100">
                    <div className="w-8 h-8 rounded-full shrink-0 overflow-hidden bg-violet-50 border border-violet-600/20">
                      {comment.author?.profilePicture ? (
                        <img src={`/uploads/avatars/${comment.author.profilePicture}`} alt={comment.author.username} className="w-full h-full object-cover" />
                      ) : comment.author?.avatar ? (
                        <img src={comment.author.avatar} alt={comment.author.username} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-violet-600 text-xs font-bold">
                          {comment.author?.username?.slice(0, 2).toUpperCase() ?? '?'}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-zinc-900">@{comment.author?.username ?? 'Inconnu'}</span>
                        <span className="text-xs text-zinc-400">{new Date(comment.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        {user?.id === comment.author?.id && (
                          <div className="ml-auto flex items-center gap-2">
                            <button onClick={() => { setEditingId(comment.id); setEditContent(comment.content); }} className="text-xs text-zinc-400 hover:text-violet-600 transition-colors">Modifier</button>
                            <button onClick={() => deleteComment.mutate(comment.id)} disabled={deleteComment.isPending} className="text-xs text-zinc-400 hover:text-red-500 transition-colors">×</button>
                          </div>
                        )}
                      </div>
                      {editingId === comment.id ? (
                        <div data-color-mode="light">
                          <div className="rounded-xl overflow-hidden border border-zinc-200 mb-2">
                            <MDEditor value={editContent} onChange={(v) => setEditContent(v ?? '')} preview="edit" height={120} textareaProps={{ maxLength: 2000 }} />
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => updateComment.mutate({ id: comment.id, content: editContent })} disabled={!editContent.trim() || updateComment.isPending}
                              className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold rounded-lg disabled:opacity-40 transition-colors">
                              {updateComment.isPending ? 'Enregistrement...' : 'Enregistrer'}
                            </button>
                            <button onClick={() => setEditingId(null)} className="px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-900 border border-zinc-200 rounded-lg transition-colors">Annuler</button>
                          </div>
                        </div>
                      ) : (
                        <div data-color-mode="light" className="text-sm">
                          <MDEditor.Markdown source={comment.content} style={{ background: 'transparent', color: 'inherit', fontSize: '0.875rem' }} />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (tutorial.source === 'community' && interactiveMode && devSteps.length > 0) {
    const step    = devSteps[currentStep];
    const isFirst = currentStep === 0;
    const isLast  = currentStep === devSteps.length - 1;
    const cmd     = step.title;
    const typedCmd = cmd.slice(0, termTyped);
    const isCmdDone = termTyped >= cmd.length;

    const goNext = () => {
      if (!isCmdDone) { setTermTyped(cmd.length); setTimeout(() => setTermShowContent(true), 200); return; }
      setDirection('next'); setCurrentStep(s => s + 1);
    };
    const goPrev = () => { setDirection('prev'); setCurrentStep(s => s - 1); };

    return (
      <div
        className="min-h-screen bg-[#0d1117] flex flex-col select-none"
        style={{ fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace" }}
        onTouchStart={e => { touchStartX.current = e.touches[0].clientX; }}
        onTouchEnd={e => {
          const diff = touchStartX.current - e.changedTouches[0].clientX;
          if (Math.abs(diff) > 50) { if (diff > 0 && !isLast) goNext(); else if (diff < 0 && !isFirst) goPrev(); }
        }}
      >
        {seoTags}
        {/* ── Title bar (macOS style) ── */}
        <div className="bg-[#1c1c1e] border-b border-[#3a3a3c] px-4 py-3 flex items-center gap-3 shrink-0">
          <div className="flex gap-1.5 shrink-0">
            <button
              onClick={() => { setInteractiveMode(false); setCurrentStep(0); }}
              className="w-3.5 h-3.5 rounded-full bg-[#ff5f57] hover:brightness-110 transition-all flex items-center justify-center group"
              title="Quitter (Esc)"
            >
              <span className="text-[#7a0000] text-[8px] font-bold opacity-0 group-hover:opacity-100">✕</span>
            </button>
            <span className="w-3.5 h-3.5 rounded-full bg-[#febc2e]" />
            <span className="w-3.5 h-3.5 rounded-full bg-[#28c840]" />
          </div>
          <span className="text-[#8e8e93] text-xs flex-1 text-center truncate">
            {tutorial.title}
          </span>
          <button
            onClick={() => { setInteractiveMode(false); setCurrentStep(0); }}
            className="text-[#8e8e93] hover:text-white text-[11px] transition-colors shrink-0"
          >
            vue complète ↗
          </button>
        </div>

        {/* ── Progress bar ── */}
        <div className="h-[3px] bg-[#1c1c1e] shrink-0">
          <div
            className="h-full bg-[#30d158] transition-all duration-500 ease-out"
            style={{ width: `${((currentStep + 1) / devSteps.length) * 100}%` }}
          />
        </div>

        {/* ── Terminal body ── */}
        <div className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
          <div className="max-w-3xl mx-auto">

            {/* History: previous steps (dimmed) */}
            {currentStep > 0 && (
              <div className="mb-6 space-y-1 opacity-30">
                {devSteps.slice(0, currentStep).map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-[#636366]">
                    <span className="text-[#30d158]">❯</span>
                    <span className="text-[#48484a]">step-{String(i + 1).padStart(2, '0')}</span>
                    <span className="text-[#636366] truncate">{s.title}</span>
                    <span className="text-[#30d158] ml-auto shrink-0">✓</span>
                  </div>
                ))}
              </div>
            )}

            {/* Current step */}
            <div key={currentStep} className={direction === 'next' ? 'animate-slide-in-right' : 'animate-slide-in-left'}>

              {/* Prompt line */}
              <div className="flex items-center gap-2 text-sm mb-3">
                <span className="text-[#30d158] font-bold shrink-0">❯</span>
                <span className="text-[#636366] shrink-0">step-{String(currentStep + 1).padStart(2, '0')}</span>
                <span className="text-white">
                  {typedCmd}
                  {!isCmdDone && (
                    <span className="inline-block w-2 h-4 bg-white ml-0.5 align-middle animate-[blink_0.8s_step-end_infinite]" />
                  )}
                </span>
              </div>

              {/* Content — revealed after typing */}
              {termShowContent && (
                <div className="animate-fade-in ml-5 mt-4">
                  {/* Separator */}
                  <div className="flex items-center gap-3 mb-5">
                    <div className="h-px flex-1 bg-[#3a3a3c]" />
                    <span className="text-[#636366] text-xs">output</span>
                    <div className="h-px flex-1 bg-[#3a3a3c]" />
                  </div>

                  {/* Markdown content */}
                  <div className="terminal-md">
                    <MDEditor.Markdown
                      source={step.content}
                      style={{ background: 'transparent', backgroundColor: 'transparent', color: '#ebebf5', fontSize: '0.875rem', lineHeight: '1.7' }}
                    />
                  </div>

                  {/* Blinking cursor at end */}
                  <div className="mt-6 flex items-center gap-2 text-sm text-[#636366]">
                    <span className="text-[#30d158]">❯</span>
                    <span className="inline-block w-2 h-4 bg-[#636366] animate-[blink_0.8s_step-end_infinite]" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Navigation ── */}
        <div className="bg-[#1c1c1e] border-t border-[#3a3a3c] px-4 py-4 shrink-0">
          <div className="max-w-3xl mx-auto space-y-3">
            {/* Step dots */}
            <div className="flex justify-center gap-1.5">
              {devSteps.map((_, i) => (
                <button
                  key={i}
                  onClick={() => { setDirection(i > currentStep ? 'next' : 'prev'); setCurrentStep(i); }}
                  className={`rounded-full transition-all duration-300 ${
                    i === currentStep ? 'w-5 h-2 bg-[#30d158]' :
                    i < currentStep  ? 'w-2 h-2 bg-[#30d158]/40' :
                                       'w-2 h-2 bg-[#3a3a3c] hover:bg-[#636366]'
                  }`}
                />
              ))}
            </div>

            {/* Buttons */}
            <div className={`flex gap-2 ${finished ? 'animate-celebrate' : ''}`}>
              <button
                onClick={goPrev}
                disabled={isFirst}
                className="flex-1 py-3.5 rounded-xl border border-[#3a3a3c] text-[#ebebf5] text-sm font-semibold
                           bg-[#2c2c2e] hover:bg-[#3a3a3c] active:scale-95 transition-all disabled:opacity-25
                           flex items-center justify-center gap-2"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Précédent
              </button>
              <button
                onClick={() => { if (isLast) finishInteractive(); else goNext(); }}
                className={`flex-1 py-3.5 rounded-xl text-sm font-bold active:scale-95 transition-all
                            flex items-center justify-center gap-2 ${
                  isLast
                    ? 'bg-[#30d158] hover:bg-[#34eb5e] text-[#0d1117] shadow-lg shadow-[#30d158]/20'
                    : !isCmdDone
                    ? 'bg-[#2c2c2e] border border-[#3a3a3c] text-[#636366] hover:text-[#ebebf5]'
                    : 'bg-[#0a84ff] hover:bg-[#338cf5] text-white shadow-lg shadow-[#0a84ff]/20'
                }`}
              >
                {isLast ? (
                  <>✓ Terminé</>
                ) : !isCmdDone ? (
                  <>
                    <span className="animate-pulse">Chargement…</span>
                  </>
                ) : (
                  <>
                    Suivant
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </>
                )}
              </button>
            </div>

            {/* Keyboard hint */}
            <p className="text-center text-[#48484a] text-[11px]">
              ← → pour naviguer &nbsp;·&nbsp; Esc pour quitter
            </p>
          </div>
        </div>

        {/* Finish overlay */}
        {finished && (
          <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 animate-fade-in">
            <img src="/done-and-done-spongebob.gif" alt="Bravo !" className="w-64 rounded-2xl shadow-2xl animate-pop-in" />
            <p className="mt-5 text-white text-2xl font-bold animate-slide-up">Bravo ! 🎉</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {seoTags}
      <div className="mb-4 flex justify-end"><AddToCollection tutorialId={tutorial.id} /></div>
      <SummaryCard tutorialId={tutorial.id} />

      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        className="text-sm text-muted hover:text-text mb-6 flex items-center gap-1 transition-colors"
      >
        ← Retour
      </button>

      {/* Cover */}
      {tutorial.thumbnailUrl && (
        <img
          src={tutorial.thumbnailUrl}
          alt={tutorial.title}
          className="w-full rounded-2xl mb-6 object-cover max-h-72 border border-border"
        />
      )}

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="text-xs font-medium px-2.5 py-1 rounded-full border text-success border-success/20 bg-success/8">
            {SOURCE_LABELS[tutorial.source] ?? tutorial.source}
          </span>
          {tutorial.categories.map((cat) => (
            <span key={cat.id} className="text-xs text-muted border border-border px-2.5 py-1 rounded-full">
              {cat.name}
            </span>
          ))}
        </div>

        <h1 className="text-2xl font-bold text-text mb-3 leading-snug">{tutorial.title}</h1>

        {tutorial.description && (
          <p className="text-muted text-sm mb-4 leading-relaxed">{tutorial.description}</p>
        )}

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-sm text-muted">
            <div className="w-7 h-7 rounded-full bg-violet-50 border border-violet-600/20 flex items-center justify-center text-violet-600 text-xs font-bold">
              {tutorial.author?.username?.slice(0, 2).toUpperCase() ?? '?'}
            </div>
            {tutorial.author ? (
              <Link to={`/users/${tutorial.author.id}`} className="text-text font-medium hover:text-violet-600 transition-colors">
                @{tutorial.author.username}
              </Link>
            ) : (
              <span className="text-text font-medium">Inconnu</span>
            )}
            <span>·</span>
            <span>{new Date(tutorial.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {tutorial.source === 'community' && devSteps.length > 0 && (
              <button
                onClick={() => startInteractive(devSteps.length)}
                className="flex items-center gap-1.5 text-xs font-mono font-semibold bg-[#0d1117] text-[#28c840] hover:bg-[#161b22] border border-[#30363d] px-3 py-1.5 rounded-lg transition-colors"
              >
                <span className="text-[#28c840]">$</span> Mode terminal
              </button>
            )}
            <ActionButtons />
            {isAuthor && (
              <Link
                to={`/tutorials/${tutorial.id}/edit`}
                className="text-xs font-medium text-violet-600 border border-violet-600/30 bg-violet-50 px-3 py-1.5 rounded-lg hover:bg-violet-600/15 transition-colors"
              >
                Modifier
              </Link>
            )}
          </div>
        </div>

        {tutorial.tags.length > 0 && (
          <div className="flex gap-2 mt-4 flex-wrap">
            {tutorial.tags.map((tag) => (
              <span key={tag.id} className="text-xs bg-surface2 text-muted border border-border px-2.5 py-1 rounded-full">
                #{tag.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Rating */}
      <div className="mt-4 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <StarRating value={ratingData?.average ?? 0} readonly size="sm" />
          <span className="text-sm font-semibold text-zinc-900">{ratingData?.average ?? 0}</span>
          <span className="text-xs text-zinc-400">({ratingData?.count ?? 0} avis)</span>
        </div>
        {isAuthenticated() && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400">Ta note :</span>
            <StarRating
              value={displayedUserRating}
              onChange={(v) => rateMutation.mutate(v)}
            />
            {ratingData?.userRating && <span className="text-xs text-violet-600 font-medium">Noté ✓</span>}
          </div>
        )}
      </div>

      <hr className="border-border mb-6 mt-4" />

      {/* Content */}
      {tutorial.content ? (
        <div data-color-mode="light">
          <MDEditor.Markdown source={tutorial.content} style={{ background: 'transparent', color: 'inherit' }} />
        </div>
      ) : (
        <p className="text-muted text-sm">Aucun contenu disponible.</p>
      )}

      {/* Related tutorials */}
      {relatedTutorials.length > 0 && (
        <div className="mt-12 border-t border-border pt-8">
          <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-5">Dans le même genre</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {relatedTutorials.map((t) => <TutorialCard key={t.id} tutorial={t} />)}
          </div>
        </div>
      )}

      {/* Comments */}
      <div className="mt-12 border-t border-border pt-8">
        <h2 className="text-lg font-bold text-text mb-6">
          Commentaires {comments.length > 0 && <span className="text-muted font-normal text-sm ml-1">({comments.length})</span>}
        </h2>

        {/* Add comment form */}
        {isAuthenticated() ? (
          <form onSubmit={handleSubmitComment} className="mb-8">
            <div data-color-mode="light" className="rounded-xl overflow-hidden border border-border">
              <MDEditor
                value={newComment}
                onChange={(v) => setNewComment(v ?? '')}
                preview="edit"
                height={160}
                textareaProps={{ maxLength: 2000, placeholder: 'Ajouter un commentaire... (Markdown supporté : **gras**, `code`, etc.)' }}
                style={{ borderRadius: 0 }}
              />
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-muted">{newComment.length}/2000</span>
              <button
                type="submit"
                disabled={!newComment.trim() || addComment.isPending}
                className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-xl disabled:opacity-40 transition-colors"
              >
                {addComment.isPending ? 'Envoi...' : 'Commenter'}
              </button>
            </div>
          </form>
        ) : (
          <div className="mb-8 text-center py-6 bg-zinc-50 rounded-xl border border-border">
            <p className="text-sm text-muted">
              <Link to="/login" className="text-violet-600 hover:text-violet-800 font-medium">Connecte-toi</Link> pour laisser un commentaire.
            </p>
          </div>
        )}

        {/* Comments list */}
        {comments.length === 0 ? (
          <p className="text-sm text-muted text-center py-6">Aucun commentaire pour le moment. Sois le premier !</p>
        ) : (
          <div className="space-y-4">
            {comments.map((comment: Comment) => (
              <div key={comment.id} className="flex gap-3 p-4 rounded-xl bg-zinc-50/60 border border-border">
                <div className="w-8 h-8 rounded-full shrink-0 overflow-hidden bg-violet-50 border border-violet-600/20">
                  {comment.author?.profilePicture ? (
                    <img src={`/uploads/avatars/${comment.author.profilePicture}`} alt={comment.author.username} className="w-full h-full object-cover" />
                  ) : comment.author?.avatar ? (
                    <img src={comment.author.avatar} alt={comment.author.username} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-violet-600 text-xs font-bold">
                      {comment.author?.username?.slice(0, 2).toUpperCase() ?? '?'}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-text">@{comment.author?.username ?? 'Inconnu'}</span>
                    <span className="text-xs text-muted">
                      {new Date(comment.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                    {user?.id === comment.author?.id && (
                      <div className="ml-auto flex items-center gap-2">
                        <button
                          onClick={() => { setEditingId(comment.id); setEditContent(comment.content); }}
                          className="text-xs text-muted hover:text-violet-600 transition-colors"
                        >
                          Modifier
                        </button>
                        <button
                          onClick={() => deleteComment.mutate(comment.id)}
                          disabled={deleteComment.isPending}
                          className="text-xs text-muted hover:text-danger transition-colors"
                        >
                          ×
                        </button>
                      </div>
                    )}
                  </div>

                  {editingId === comment.id ? (
                    <div data-color-mode="light">
                      <div className="rounded-xl overflow-hidden border border-border mb-2">
                        <MDEditor
                          value={editContent}
                          onChange={(v) => setEditContent(v ?? '')}
                          preview="edit"
                          height={120}
                          textareaProps={{ maxLength: 2000 }}
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => updateComment.mutate({ id: comment.id, content: editContent })}
                          disabled={!editContent.trim() || updateComment.isPending}
                          className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold rounded-lg disabled:opacity-40 transition-colors"
                        >
                          {updateComment.isPending ? 'Enregistrement...' : 'Enregistrer'}
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-3 py-1.5 text-xs text-muted hover:text-text border border-border rounded-lg transition-colors"
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div data-color-mode="light" className="text-sm">
                      <MDEditor.Markdown source={comment.content} style={{ background: 'transparent', color: 'inherit', fontSize: '0.875rem' }} />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
