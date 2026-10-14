import { useState, useMemo, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { useProgressKeys, useToggleProgress } from '../hooks/useProgress';
import { StarRating } from '../components/StarRating';

interface MealDBRecipe {
  id: string;
  title: string;
  category: string | null;
  area: string | null;
  thumbnail: string | null;
  instructions: string;
  ingredients: { name: string; measure: string }[];
  tags: string[];
  youtube: string | null;
  source: string | null;
}

interface Translation {
  title: string;
  instructions: string;
  ingredients: string[];
}

async function translate(text: string): Promise<string> {
  const { data } = await apiClient.post<{ translated: string }>('/api/translate', {
    text, from: 'en', to: 'fr',
  });
  return data.translated;
}

function parseSteps(instructions: string): string[] {
  const lines = instructions
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}|\n(?=\d+[.)]\s)|(?<=\.)\s+(?=[A-Z])|(?:^|\n)(?:step\s*\d+[:.]?)\s*/gi)
    .map(s => s.replace(/^\d+[.)]\s*/, '').replace(/^step\s*\d+[:.]?\s*/i, '').trim())
    .filter(s => s.length > 10);
  return lines.length >= 2 ? lines : instructions.split('\n').filter(s => s.trim().length > 10);
}

const DEFAULT_SERVINGS = 4;

function parseMeasure(measure: string): { amount: number; unit: string } | null {
  const m = measure.trim();
  if (!m) return null;
  const match = m.match(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d+\.?\d*)\s*(.*)/);
  if (!match) return null;
  const raw = match[1].trim();
  const unit = match[2].trim();
  let amount: number;
  if (raw.includes('/')) {
    const parts = raw.split(/\s+/);
    if (parts.length === 2) {
      const [n, d] = parts[1].split('/').map(Number);
      amount = parseInt(parts[0]) + n / d;
    } else {
      const [n, d] = raw.split('/').map(Number);
      amount = n / d;
    }
  } else {
    amount = parseFloat(raw);
  }
  return isNaN(amount) ? null : { amount, unit };
}

function formatAmount(n: number): string {
  if (n <= 0) return '—';
  const whole = Math.floor(n);
  const frac = n - whole;
  const FRACS: [number, string][] = [
    [1/8,'⅛'],[1/4,'¼'],[1/3,'⅓'],[3/8,'⅜'],
    [1/2,'½'],[5/8,'⅝'],[2/3,'⅔'],[3/4,'¾'],[7/8,'⅞'],
  ];
  if (frac < 0.05) return whole > 0 ? String(whole) : '0';
  const best = FRACS.reduce((p, c) => Math.abs(c[0] - frac) < Math.abs(p[0] - frac) ? c : p);
  if (Math.abs(best[0] - frac) < 0.07) return whole > 0 ? `${whole}${best[1]}` : best[1];
  return n % 1 === 0 ? String(n) : n.toFixed(1);
}

function scaleMeasure(measure: string, factor: number): string {
  const parsed = parseMeasure(measure);
  if (!parsed) return measure;
  const scaled = parsed.amount * factor;
  return `${formatAmount(scaled)}${parsed.unit ? ' ' + parsed.unit : ''}`.trim();
}

interface RecipeReview {
  id: number;
  rating: number;
  comment: string | null;
  createdAt: string;
  author: { id: number; username: string };
}

interface ReviewsData {
  average: number;
  count: number;
  userReviewId: number | null;
  userRating: number | null;
  reviews: RecipeReview[];
}

export function RecipePage() {
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  const queryClient = useQueryClient();

  // ── Existing state ───────────────────────────────────────────────────────────
  const [lang, setLang]               = useState<'en' | 'fr'>('en');
  const [translation, setTranslation] = useState<Translation | null>(null);
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState(false);
  const [reviewRating, setReviewRating]   = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [servings, setServings] = useState(DEFAULT_SERVINGS);
  const scaleFactor = useMemo(() => servings / DEFAULT_SERVINGS, [servings]);

  // ── Interactive mode state ───────────────────────────────────────────────────
  const [interactiveMode, setInteractiveMode] = useState(false);
  const [currentStep, setCurrentStep]         = useState(0);
  const [direction, setDirection]             = useState<'next' | 'prev'>('next');
  const [finished, setFinished]               = useState(false);
  const touchStartX      = useRef(0);
  const autoTranslated   = useRef(false);

  // ── Progress ─────────────────────────────────────────────────────────────────
  const { data: progressKeys = [] } = useProgressKeys();
  const toggleProgress              = useToggleProgress();

  // ── Queries ──────────────────────────────────────────────────────────────────
  const { data: reviewsData, refetch: refetchReviews } = useQuery({
    queryKey: ['recipe-reviews', id],
    queryFn: async () => {
      const { data } = await apiClient.get<ReviewsData>(`/api/recipe/${id}/reviews`);
      return data;
    },
    enabled: !!id,
  });

  const submitReview = useMutation({
    mutationFn: () => apiClient.post(`/api/recipe/${id}/reviews`, { rating: reviewRating, comment: reviewComment || null }),
    onSuccess: () => { refetchReviews(); setReviewSubmitted(true); setReviewComment(''); },
  });

  const deleteReview = useMutation({
    mutationFn: (reviewId: number) => apiClient.delete(`/api/recipe-reviews/${reviewId}`),
    onSuccess: () => {
      refetchReviews();
      setReviewRating(0); setReviewComment(''); setReviewSubmitted(false);
      queryClient.invalidateQueries({ queryKey: ['recipe-reviews', id] });
    },
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ['recipe', id],
    queryFn: async () => {
      const { data } = await apiClient.get<MealDBRecipe>(`/api/recipe/${id}`);
      return data;
    },
    staleTime: 1000 * 60 * 30,
  });

  // ── Auto-translate Spoonacular recipes on load ───────────────────────────────
  useEffect(() => {
    if (!data || !String(data.id).startsWith('spoonacular-') || autoTranslated.current) return;
    autoTranslated.current = true;
    setTranslating(true);
    setTranslateError(false);
    const names = data.ingredients.map(i => i.name).join('\n');
    Promise.all([
      translate(data.title),
      translate(data.instructions),
      translate(names),
    ]).then(([titleFr, instructionsFr, ingredientsFr]) => {
      setTranslation({ title: titleFr, instructions: instructionsFr, ingredients: ingredientsFr.split('\n').map(s => s.trim()) });
      setLang('fr');
    }).catch(() => {
      setTranslateError(true);
    }).finally(() => {
      setTranslating(false);
    });
  }, [data]);

  // ── Scroll to top when interactive mode activates ────────────────────────────
  useEffect(() => {
    if (interactiveMode) window.scrollTo({ top: 0, behavior: 'instant' });
  }, [interactiveMode]);

  // ── Early returns ────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center mt-20 gap-3">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-zinc-400">Chargement de la recette…</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <p className="text-red-500 font-semibold mb-2">Recette introuvable.</p>
        <button onClick={() => navigate(-1)} className="text-sm text-violet-600 hover:text-violet-800">← Retour</button>
      </div>
    );
  }

  // ── Derived values ───────────────────────────────────────────────────────────
  const isSpoonacular       = String(data.id).startsWith('spoonacular-');
  const recipeSlug          = isSpoonacular ? String(data.id) : `mealdb-${data.id}`;
  const isDone              = progressKeys.includes(recipeSlug);
  const isFr                = lang === 'fr' && !!translation;
  const displayTitle        = isFr ? translation!.title        : data.title;
  const displayInstructions = isFr ? translation!.instructions : data.instructions;
  const steps               = parseSteps(displayInstructions);

  const STEPS_PER_SLIDE = 4;

  const interactiveSteps: (
    | { label: string; type: 'ingredients' }
    | { label: string; type: 'steps'; items: { content: string; num: number }[] }
  )[] = [
    { label: isFr ? 'Ingrédients' : 'Ingredients', type: 'ingredients' },
    ...Array.from({ length: Math.ceil(steps.length / STEPS_PER_SLIDE) }, (_, groupIdx) => {
      const start = groupIdx * STEPS_PER_SLIDE;
      const groupSteps = steps.slice(start, start + STEPS_PER_SLIDE);
      const firstNum = start + 1;
      const lastNum  = start + groupSteps.length;
      return {
        label: groupSteps.length === 1 ? `Étape ${firstNum}` : `Étapes ${firstNum}–${lastNum}`,
        type: 'steps' as const,
        items: groupSteps.map((content, i) => ({ content, num: start + i + 1 })),
      };
    }),
  ];

  const handleTranslate = async () => {
    if (lang === 'fr') { setLang('en'); return; }
    if (translation)   { setLang('fr'); return; }
    setTranslating(true); setTranslateError(false);
    try {
      const names = data.ingredients.map(i => i.name).join('\n');
      const [titleFr, instructionsFr, ingredientsFr] = await Promise.all([
        translate(data.title), translate(data.instructions), translate(names),
      ]);
      setTranslation({ title: titleFr, instructions: instructionsFr, ingredients: ingredientsFr.split('\n').map(s => s.trim()) });
      setLang('fr');
    } catch { setTranslateError(true); }
    finally  { setTranslating(false); }
  };

  const startInteractive = () => {
    const lsKey = `ytuto_step_recipe_${id}`;
    const saved = localStorage.getItem(lsKey);
    let resumeStep = 0;
    if (saved) {
      try {
        const { step, total } = JSON.parse(saved) as { step: number; total: number };
        if (total === interactiveSteps.length && step > 0 && step < total) resumeStep = step;
      } catch { /* ignore */ }
    }
    if (isAuthenticated() && !isDone) {
      toggleProgress.mutate({
        slug: recipeSlug,
        source: 'recipe',
        title: displayTitle,
        thumbnailUrl: data.thumbnail ?? undefined,
        externalUrl: data.source ?? undefined,
      });
    }
    setCurrentStep(resumeStep);
    setDirection('next');
    setInteractiveMode(true);
  };

  const finishInteractive = () => {
    localStorage.removeItem(`ytuto_step_recipe_${id}`);
    setFinished(true);
    setTimeout(() => { setFinished(false); setInteractiveMode(false); setCurrentStep(0); }, 3500);
  };

  // ── Interactive mode ─────────────────────────────────────────────────────────
  if (interactiveMode && interactiveSteps.length > 1) {
    const step    = interactiveSteps[currentStep];
    const isFirst = currentStep === 0;
    const isLast  = currentStep === interactiveSteps.length - 1;
    const goNext  = () => { setDirection('next'); setCurrentStep(s => s + 1); };
    const goPrev  = () => { setDirection('prev'); setCurrentStep(s => s - 1); };

    // Persist progress
    localStorage.setItem(`ytuto_step_recipe_${id}`, JSON.stringify({ step: currentStep, total: interactiveSteps.length }));

    return (
      <div
        className="min-h-screen bg-white"
        onTouchStart={e => { touchStartX.current = e.touches[0].clientX; }}
        onTouchEnd={e => {
          const diff = touchStartX.current - e.changedTouches[0].clientX;
          if (Math.abs(diff) > 50) { if (diff > 0 && !isLast) goNext(); else if (diff < 0 && !isFirst) goPrev(); }
        }}
      >
        {/* Header */}
        <div className="bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 text-white">
          <div className="max-w-2xl mx-auto px-5 pt-6 pb-6">
            <div className="flex items-center justify-between mb-4">
              <button onClick={() => navigate(-1)} className="text-amber-100 hover:text-white text-sm flex items-center gap-1 transition-colors">← Retour</button>
              <button onClick={() => { setInteractiveMode(false); setCurrentStep(0); }} className="text-xs bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-full transition-colors">Vue complète ↗</button>
            </div>
            <h1 className="text-lg font-bold leading-snug mb-3">{displayTitle}</h1>
            <div className="bg-white/20 rounded-full h-1.5 mb-3">
              <div className="bg-white rounded-full h-1.5 transition-all duration-500 ease-out" style={{ width: `${((currentStep + 1) / interactiveSteps.length) * 100}%` }} />
            </div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold text-amber-100">{step.label}</span>
              <div className="flex gap-1.5">
                {interactiveSteps.map((_, i) => (
                  <button key={i} onClick={() => { setDirection(i > currentStep ? 'next' : 'prev'); setCurrentStep(i); }}
                    className={`rounded-full transition-all duration-300 ${i === currentStep ? 'w-5 h-2 bg-white' : 'w-2 h-2 bg-white/35 hover:bg-white/60'}`} />
                ))}
              </div>
            </div>
            {/* Nav buttons inside the header */}
            <div className={`flex gap-3 ${finished ? 'animate-celebrate' : ''}`}>
              <button onClick={goPrev} disabled={isFirst}
                className="flex-1 py-2.5 rounded-xl bg-white/15 border border-white/30 text-white text-sm font-medium hover:bg-white/25 active:scale-95 transition-all disabled:opacity-30">
                ← Précédent
              </button>
              <button onClick={() => { if (isLast) finishInteractive(); else goNext(); }}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold active:scale-95 transition-all ${isLast ? 'bg-emerald-400 hover:bg-emerald-300 text-white shadow-lg' : 'bg-white text-amber-600 hover:bg-amber-50'}`}>
                {isLast ? '✓ Terminer' : 'Suivant →'}
              </button>
            </div>
          </div>
        </div>

        {/* Step content */}
        <div className="max-w-2xl mx-auto w-full px-5 py-8">
          <div key={currentStep} className={direction === 'next' ? 'animate-slide-in-right' : 'animate-slide-in-left'}>
            {step.type === 'ingredients' ? (
              <>
                <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                  <h2 className="text-xl font-bold text-zinc-900">
                    {isFr ? 'Ingrédients' : 'Ingredients'}
                    <span className="text-sm font-normal text-zinc-400 ml-2">({data.ingredients.length})</span>
                  </h2>
                  <div className="flex items-center gap-2.5 bg-amber-50 border border-amber-200/60 rounded-xl px-3 py-1.5">
                    <span className="text-xs text-amber-700 font-medium whitespace-nowrap">🍽 Personnes</span>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => setServings(s => Math.max(1, s - 1))} disabled={servings <= 1}
                        className="w-6 h-6 rounded-lg bg-white border border-amber-200 text-amber-700 font-bold text-sm flex items-center justify-center hover:bg-amber-100 transition-colors disabled:opacity-40">−</button>
                      <span className="w-6 text-center text-sm font-bold text-amber-800">{servings}</span>
                      <button onClick={() => setServings(s => Math.min(20, s + 1))} disabled={servings >= 20}
                        className="w-6 h-6 rounded-lg bg-white border border-amber-200 text-amber-700 font-bold text-sm flex items-center justify-center hover:bg-amber-100 transition-colors disabled:opacity-40">+</button>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {data.ingredients.map((ing, i) => {
                    const name    = isFr && translation?.ingredients[i] ? translation.ingredients[i] : ing.name;
                    const measure = scaleFactor === 1 ? ing.measure : scaleMeasure(ing.measure, scaleFactor);
                    return (
                      <div key={i} className="animate-pop-in flex items-center gap-3 bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-3" style={{ animationDelay: `${i * 35}ms` }}>
                        <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                        <span className="text-xs font-semibold text-zinc-900 shrink-0">{measure}</span>
                        <span className="text-sm text-zinc-700 leading-snug">{name}</span>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-5">
                {step.type === 'steps' && step.items.map(({ content, num }, i) => (
                  <div key={num} className="animate-pop-in" style={{ animationDelay: `${i * 80}ms` }}>
                    <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-100 text-amber-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-2">
                      <span className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px] font-bold">{num}</span>
                      Étape {num}
                    </div>
                    <p className="text-sm text-zinc-700 leading-relaxed">{content}</p>
                  </div>
                ))}
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

  // ── Normal page ──────────────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">

      <button onClick={() => navigate(-1)} className="text-sm text-zinc-400 hover:text-zinc-900 mb-6 flex items-center gap-1 transition-colors">
        ← Retour
      </button>

      {/* Cover */}
      {data.thumbnail && (
        <img src={data.thumbnail} alt={data.title} className="w-full rounded-2xl mb-6 object-cover max-h-80 border border-zinc-100" />
      )}

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 ring-1 ring-amber-600/20">🍳 Recette</span>
            {data.category && <span className="text-xs text-zinc-500 bg-zinc-50 ring-1 ring-zinc-200 px-2.5 py-1 rounded-full">{data.category}</span>}
            {data.area     && <span className="text-xs text-zinc-500 bg-zinc-50 ring-1 ring-zinc-200 px-2.5 py-1 rounded-full">🌍 {data.area}</span>}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Translate button — always visible for MealDB, hidden for Spoonacular (auto-translated) */}
            {!isSpoonacular && (
              <button onClick={handleTranslate} disabled={translating}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all shrink-0 ${
                  isFr ? 'bg-violet-600 text-white border-violet-600 shadow-sm shadow-violet-500/20'
                       : 'bg-white text-zinc-700 border-zinc-200 hover:border-violet-300 hover:text-violet-700'
                } disabled:opacity-60`}>
                {translating
                  ? <><span className="w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin" /> Traduction...</>
                  : isFr ? '🇬🇧 Original' : '🇫🇷 Traduire'}
              </button>
            )}

            {/* Spoonacular: show translation status */}
            {isSpoonacular && translating && (
              <span className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl">
                <span className="w-3 h-3 border border-amber-600 border-t-transparent rounded-full animate-spin" />
                Traduction en cours…
              </span>
            )}
            {isSpoonacular && isFr && !translating && (
              <span className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl font-medium">
                🇫🇷 Traduit automatiquement
              </span>
            )}

            {/* Interactive mode button */}
            {interactiveSteps.length > 1 && !translating && (
              <button onClick={startInteractive}
                className="flex items-center gap-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white px-3.5 py-1.5 rounded-xl transition-colors shadow-sm">
                ▶ Mode interactif
              </button>
            )}
          </div>
        </div>

        {translateError && <p className="text-xs text-red-400 mb-3">La traduction a échoué, réessaie.</p>}

        <h1 className="text-3xl font-bold text-zinc-900 leading-snug">
          {displayTitle}
          {isFr && <span className="ml-2 text-base font-normal text-zinc-400 italic">(traduit)</span>}
        </h1>

        {data.tags.length > 0 && (
          <div className="flex gap-2 flex-wrap mt-3">
            {data.tags.map(tag => (
              <span key={tag} className="text-xs bg-zinc-50 text-zinc-500 ring-1 ring-zinc-200 px-2.5 py-1 rounded-full">#{tag}</span>
            ))}
          </div>
        )}
      </div>

      <hr className="border-zinc-100 mb-8" />

      {/* Ingrédients */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h2 className="text-base font-bold text-zinc-900">
            {isFr ? 'Ingrédients' : 'Ingredients'}
            <span className="ml-2 text-xs font-normal text-zinc-400">({data.ingredients.length})</span>
          </h2>
          <div className="flex items-center gap-2.5 bg-amber-50 border border-amber-200/60 rounded-xl px-3 py-1.5">
            <span className="text-xs text-amber-700 font-medium whitespace-nowrap">🍽 Personnes</span>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setServings(s => Math.max(1, s - 1))} disabled={servings <= 1}
                className="w-6 h-6 rounded-lg bg-white border border-amber-200 text-amber-700 font-bold text-sm flex items-center justify-center hover:bg-amber-100 transition-colors disabled:opacity-40">−</button>
              <span className="w-6 text-center text-sm font-bold text-amber-800">{servings}</span>
              <button onClick={() => setServings(s => Math.min(20, s + 1))} disabled={servings >= 20}
                className="w-6 h-6 rounded-lg bg-white border border-amber-200 text-amber-700 font-bold text-sm flex items-center justify-center hover:bg-amber-100 transition-colors disabled:opacity-40">+</button>
            </div>
            {servings !== DEFAULT_SERVINGS && (
              <button onClick={() => setServings(DEFAULT_SERVINGS)} className="text-xs text-amber-500 hover:text-amber-700 transition-colors ml-1" title="Remettre à 4">↺</button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {data.ingredients.map((ing, i) => {
            const name    = isFr && translation?.ingredients[i] ? translation.ingredients[i] : ing.name;
            const measure = scaleFactor === 1 ? ing.measure : scaleMeasure(ing.measure, scaleFactor);
            return (
              <div key={i} className="flex items-center gap-2.5 bg-zinc-50 border border-zinc-100 rounded-xl px-3 py-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                <span className="text-xs font-semibold text-zinc-900 shrink-0">{measure}</span>
                <span className="text-xs text-zinc-600 truncate">{name}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Étapes */}
      <section className="mb-8">
        <h2 className="text-base font-bold text-zinc-900 mb-4">
          {isFr ? 'Préparation' : 'Instructions'}
          <span className="ml-2 text-xs font-normal text-zinc-400">({steps.length} étapes)</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {steps.map((step, i) => (
            <div key={i} className="flex gap-3">
              <div className="shrink-0 w-7 h-7 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center">
                <span className="text-xs font-bold text-amber-600">{i + 1}</span>
              </div>
              <p className="text-sm text-zinc-700 leading-relaxed pt-0.5">{step}</p>
            </div>
          ))}
        </div>
      </section>

      {/* YouTube */}
      {data.youtube && (
        <div className="p-5 bg-zinc-50 border border-zinc-100 rounded-2xl flex items-center gap-4 mb-4">
          <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-red-500">
              <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.4a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z" stroke="currentColor" strokeWidth="1.5"/>
              <polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="currentColor"/>
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-zinc-900">Voir la recette en vidéo</p>
            <p className="text-xs text-zinc-400">Tutoriel YouTube disponible</p>
          </div>
          <a href={data.youtube} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-red-500 hover:text-red-700 transition-colors">Regarder ↗</a>
        </div>
      )}

      {data.source && (
        <p className="text-xs text-zinc-400 mb-8">
          Source : <a href={data.source} target="_blank" rel="noopener noreferrer" className="text-amber-600 hover:text-amber-800">Voir la recette originale →</a>
        </p>
      )}

      {/* Reviews */}
      <div className="mt-12 border-t border-zinc-100 pt-8">
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <h2 className="text-lg font-bold text-zinc-900">Avis</h2>
          {(reviewsData?.count ?? 0) > 0 && (
            <div className="flex items-center gap-2">
              <StarRating value={reviewsData?.average ?? 0} readonly size="sm" />
              <span className="text-sm font-semibold text-zinc-900">{reviewsData?.average}</span>
              <span className="text-xs text-zinc-400">({reviewsData?.count} avis)</span>
            </div>
          )}
        </div>

        {isAuthenticated() ? (
          reviewsData?.userRating && !reviewSubmitted ? (
            <div className="mb-8 p-4 bg-amber-50 border border-amber-200/60 rounded-xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <StarRating value={reviewsData.userRating} readonly size="sm" />
                <span className="text-sm text-zinc-600">Tu as déjà noté cette recette.</span>
              </div>
              <button onClick={() => reviewsData.userReviewId && deleteReview.mutate(reviewsData.userReviewId)} className="text-xs text-zinc-400 hover:text-red-500 transition-colors">Supprimer</button>
            </div>
          ) : reviewSubmitted ? (
            <div className="mb-8 p-4 bg-green-50 border border-green-200/60 rounded-xl text-sm text-green-700 font-medium">Merci pour ton avis ! 🎉</div>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); if (reviewRating > 0) submitReview.mutate(); }} className="mb-8 p-5 bg-zinc-50 border border-zinc-100 rounded-2xl">
              <p className="text-sm font-semibold text-zinc-700 mb-3">Laisser un avis</p>
              <div className="flex items-center gap-3 mb-4">
                <StarRating value={reviewRating} onChange={setReviewRating} />
                {reviewRating > 0 && <span className="text-xs text-zinc-400">{['','Mauvais','Bof','Correct','Bien','Excellent'][reviewRating]}</span>}
              </div>
              <textarea value={reviewComment} onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Ton commentaire (optionnel)..." rows={3} maxLength={1000}
                className="w-full px-4 py-3 border border-zinc-200 rounded-xl text-sm text-zinc-900 placeholder:text-zinc-400 bg-white focus:outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-500/10 transition-all resize-none mb-3" />
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400">{reviewComment.length}/1000</span>
                <button type="submit" disabled={reviewRating === 0 || submitReview.isPending}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-xl disabled:opacity-40 transition-colors">
                  {submitReview.isPending ? 'Envoi...' : 'Publier mon avis'}
                </button>
              </div>
            </form>
          )
        ) : (
          <div className="mb-8 text-center py-6 bg-zinc-50 rounded-xl border border-zinc-100">
            <p className="text-sm text-zinc-500">
              <Link to="/login" className="text-amber-600 hover:text-amber-800 font-medium">Connecte-toi</Link> pour laisser un avis.
            </p>
          </div>
        )}

        {(reviewsData?.reviews.length ?? 0) === 0 ? (
          <p className="text-sm text-zinc-400 text-center py-6">Aucun avis pour le moment. Sois le premier !</p>
        ) : (
          <div className="space-y-4">
            {reviewsData?.reviews.map((review) => (
              <div key={review.id} className="flex gap-3 p-4 rounded-xl bg-zinc-50/60 border border-zinc-100">
                <div className="w-8 h-8 rounded-full bg-amber-50 border border-amber-200/60 flex items-center justify-center text-amber-600 text-xs font-bold shrink-0">
                  {review.author.username.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-sm font-medium text-zinc-900">@{review.author.username}</span>
                    <StarRating value={review.rating} readonly size="sm" />
                    <span className="text-xs text-zinc-400">{new Date(review.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    {user?.id === review.author.id && (
                      <button onClick={() => deleteReview.mutate(review.id)} className="ml-auto text-xs text-zinc-400 hover:text-red-500 transition-colors">×</button>
                    )}
                  </div>
                  {review.comment && <p className="text-sm text-zinc-600 whitespace-pre-wrap break-words">{review.comment}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
