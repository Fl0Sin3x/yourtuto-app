import { useRef, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import DOMPurify from 'dompurify';
import { apiClient } from '../api/client';

interface Heading { id: string; text: string; level: number }

interface DevToArticle {
  id: number;
  title: string;
  description: string | null;
  bodyHtml: string;
  coverImage: string | null;
  publishedAt: string | null;
  url: string;
  author: { name: string | null; avatar: string | null };
  tags: string[];
  readingTime: number | null;
}

export function DevToArticlePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['devto-article', id],
    queryFn: async () => {
      const { data } = await apiClient.get<DevToArticle>(`/api/devto-article/${id}`);
      return data;
    },
    staleTime: 1000 * 60 * 10,
  });

  const contentRef = useRef<HTMLDivElement>(null);
  const [headings, setHeadings] = useState<Heading[]>([]);
  const safeHtml = data ? DOMPurify.sanitize(data.bodyHtml) : '';

  useEffect(() => {
    if (!contentRef.current || !safeHtml) return;
    const elements = Array.from(contentRef.current.querySelectorAll('h1, h2, h3, h4'));
    const parsed = elements.map((el, i) => {
      const id = `toc-${i}`;
      (el as HTMLElement).id = id;
      return { id, text: el.textContent?.trim() ?? '', level: parseInt(el.tagName[1]) };
    }).filter(h => h.text);
    setHeadings(parsed);
  }, [safeHtml]);

  if (isLoading) {
    return (
      <div className="flex justify-center mt-20">
        <div className="w-8 h-8 border-3 border-purple border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <p className="text-danger mb-4">Article introuvable.</p>
        <button onClick={() => navigate(-1)} className="text-sm text-violet-600 hover:text-violet-800 transition-colors">
          ← Retour
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        className="text-sm text-muted hover:text-text mb-6 flex items-center gap-1 transition-colors"
      >
        ← Retour
      </button>

      {/* Cover */}
      {data.coverImage && (
        <img
          src={data.coverImage}
          alt={data.title}
          className="w-full rounded-2xl mb-6 object-cover max-h-72 border border-border"
        />
      )}

      {/* Header */}
      <div className="mb-6">
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-purple/10 text-purple border border-purple/20 mb-3 inline-block">
          DEV.to
        </span>
        <h1 className="text-2xl font-bold text-text mb-3 leading-snug">{data.title}</h1>

        <div className="flex items-center gap-3 text-sm text-muted">
          {data.author.avatar && (
            <img src={data.author.avatar} alt={data.author.name ?? ''} className="w-7 h-7 rounded-full border border-border" />
          )}
          {data.author.name && <span className="text-text font-medium">{data.author.name}</span>}
          {data.publishedAt && (
            <span>· {new Date(data.publishedAt).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
          )}
          {data.readingTime && <span>· {data.readingTime} min</span>}
        </div>

        {data.tags.length > 0 && (
          <div className="flex gap-2 mt-3 flex-wrap">
            {data.tags.map(tag => (
              <span key={tag} className="text-xs bg-surface2 text-muted border border-border px-2.5 py-1 rounded-full">
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <hr className="border-border mb-6" />

      {/* Layout 2 colonnes */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-10 items-start">
        {/* Article body */}
        <div
          ref={contentRef}
          className="prose prose-slate max-w-none"
          dangerouslySetInnerHTML={{ __html: safeHtml }}
        />

        {/* Sidebar sticky TOC */}
        {headings.length > 0 && (
          <aside className="hidden lg:block lg:sticky lg:top-6">
            <div className="bg-surface2 border border-border rounded-2xl p-4">
              <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Chapitres</h3>
              <nav className="space-y-0.5">
                {headings.map(h => (
                  <a
                    key={h.id}
                    href={`#${h.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      document.getElementById(h.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    className={`block text-muted hover:text-text hover:bg-border/40 transition-colors rounded-lg py-1.5 leading-snug cursor-pointer ${
                      h.level === 1 ? 'px-3 text-sm font-semibold' :
                      h.level === 2 ? 'px-3 text-sm' :
                      h.level === 3 ? 'pl-5 pr-3 text-xs' :
                      'pl-7 pr-3 text-xs text-muted/70'
                    }`}
                  >
                    {h.text}
                  </a>
                ))}
              </nav>
            </div>
            <div className="mt-4 text-center">
              <a href={data.url} target="_blank" rel="noopener noreferrer" className="text-xs text-purple font-medium hover:text-purple/80 transition-colors">
                Voir sur DEV.to →
              </a>
            </div>
          </aside>
        )}
      </div>

      {/* Footer link (mobile) */}
      <div className="mt-10 pt-6 border-t border-border text-sm text-muted lg:hidden">
        Article original sur{' '}
        <a href={data.url} target="_blank" rel="noopener noreferrer" className="text-purple font-medium hover:text-purple/80 transition-colors">
          DEV.to →
        </a>
      </div>
    </div>
  );
}
