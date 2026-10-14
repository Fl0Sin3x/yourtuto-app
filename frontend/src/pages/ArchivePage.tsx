import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';

interface ArchiveItem {
  identifier: string;
  title: string;
  description: string | null;
  creator: string | null;
  year: string | null;
  subjects: string[];
  language: string | null;
  thumbnail: string;
  embedUrl: string;
  externalUrl: string;
}

async function translate(text: string): Promise<string> {
  const { data } = await apiClient.post<{ translated: string }>('/api/translate', {
    text, from: 'en', to: 'fr',
  });
  return data.translated;
}

export function ArchivePage() {
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [lang, setLang]               = useState<'en' | 'fr'>('en');
  const [translation, setTranslation] = useState<{ title: string; description: string } | null>(null);
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState(false);
  const [showReader, setShowReader]   = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['archive', id],
    queryFn: async () => {
      const { data } = await apiClient.get<ArchiveItem>(`/api/archive/${id}`);
      return data;
    },
    staleTime: 1000 * 60 * 60,
    enabled: !!id,
  });

  const handleTranslate = async () => {
    if (!data) return;
    if (lang === 'fr') { setLang('en'); return; }
    if (translation)   { setLang('fr'); return; }

    setTranslating(true);
    setTranslateError(false);
    try {
      const toTranslate = [data.title, data.description ?? ''].filter(Boolean);
      const results = await Promise.all(toTranslate.map(t => translate(t)));
      setTranslation({ title: results[0], description: results[1] ?? '' });
      setLang('fr');
    } catch {
      setTranslateError(true);
    } finally {
      setTranslating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center mt-20">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <p className="text-red-500 font-semibold mb-2">Document introuvable.</p>
        <button onClick={() => navigate(-1)} className="text-sm text-violet-600 hover:text-violet-800">← Retour</button>
      </div>
    );
  }

  const isFr          = lang === 'fr' && !!translation;
  const displayTitle  = isFr ? translation!.title       : data.title;
  const displayDesc   = isFr ? translation!.description : (data.description ?? '');

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">

      <button
        onClick={() => navigate(-1)}
        className="text-sm text-zinc-400 hover:text-zinc-900 mb-6 flex items-center gap-1 transition-colors"
      >
        ← Retour
      </button>

      {/* Cover */}
      <img
        src={data.thumbnail}
        alt={data.title}
        className="w-full rounded-2xl mb-6 object-cover max-h-72 border border-zinc-100 bg-zinc-100"
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600/20">
              📚 Archive.org
            </span>
            <span className="text-xs text-zinc-500 bg-zinc-50 ring-1 ring-zinc-200 px-2.5 py-1 rounded-full">
              Domaine public
            </span>
            {data.year && (
              <span className="text-xs text-zinc-500 bg-zinc-50 ring-1 ring-zinc-200 px-2.5 py-1 rounded-full">
                📅 {data.year}
              </span>
            )}
            {data.language && (
              <span className="text-xs text-zinc-500 bg-zinc-50 ring-1 ring-zinc-200 px-2.5 py-1 rounded-full">
                {data.language}
              </span>
            )}
          </div>

          <button
            onClick={handleTranslate}
            disabled={translating}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all shrink-0 ${
              isFr
                ? 'bg-violet-600 text-white border-violet-600 shadow-sm shadow-violet-500/20'
                : 'bg-white text-zinc-700 border-zinc-200 hover:border-violet-300 hover:text-violet-700'
            } disabled:opacity-60`}
          >
            {translating
              ? <><span className="w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin" /> Traduction...</>
              : isFr ? '🇬🇧 Original' : '🇫🇷 Traduire'}
          </button>
        </div>

        {translateError && <p className="text-xs text-red-400 mb-3">La traduction a échoué, réessaie.</p>}

        <h1 className="text-3xl font-bold text-zinc-900 leading-snug mb-2">
          {displayTitle}
          {isFr && <span className="ml-2 text-base font-normal text-zinc-400 italic">(traduit)</span>}
        </h1>

        {data.creator && (
          <p className="text-sm text-zinc-500 mb-3">Par <span className="font-medium text-zinc-700">{data.creator}</span></p>
        )}

        {data.subjects.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {data.subjects.map(s => (
              <span key={s} className="text-xs bg-zinc-50 text-zinc-500 ring-1 ring-zinc-200 px-2.5 py-1 rounded-full">#{s}</span>
            ))}
          </div>
        )}
      </div>

      <hr className="border-zinc-100 mb-6" />

      {/* Description */}
      {displayDesc && (
        <section className="mb-8">
          <h2 className="text-base font-bold text-zinc-900 mb-3">À propos</h2>
          <p className="text-sm text-zinc-600 leading-relaxed">{displayDesc}</p>
        </section>
      )}

      {/* Embedded reader */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-base font-bold text-zinc-900">Lire le document</h2>
          <button
            onClick={() => setShowReader(r => !r)}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 border border-indigo-200 hover:border-indigo-400 px-3 py-1.5 rounded-xl transition-all bg-indigo-50"
          >
            {showReader ? 'Masquer le lecteur' : 'Ouvrir le lecteur ↓'}
          </button>
        </div>

        {showReader && (
          <div className="rounded-2xl overflow-hidden border border-zinc-200 shadow-sm">
            <iframe
              src={data.embedUrl}
              className="w-full"
              style={{ height: '600px' }}
              allowFullScreen
              title={data.title}
            />
          </div>
        )}

        {!showReader && (
          <div className="p-5 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-white border border-indigo-200 flex items-center justify-center shrink-0 text-lg">
              📖
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-zinc-900">Manuel en lecture libre</p>
              <p className="text-xs text-zinc-500">Document public disponible en lecture intégrale</p>
            </div>
            <button
              onClick={() => setShowReader(true)}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors shrink-0"
            >
              Lire →
            </button>
          </div>
        )}
      </section>

      {/* External link */}
      <div className="p-4 bg-zinc-50 border border-zinc-100 rounded-xl flex items-center justify-between gap-3">
        <p className="text-xs text-zinc-500">Voir sur Archive.org pour télécharger ou lire d'autres formats</p>
        <a
          href={data.externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 whitespace-nowrap transition-colors"
        >
          Ouvrir ↗
        </a>
      </div>
    </div>
  );
}
