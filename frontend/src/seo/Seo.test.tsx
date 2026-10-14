import { describe, expect, it } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { Seo } from './Seo';

describe('Seo', () => {
  it('sets title, description, canonical and Open Graph tags', async () => {
    render(<Seo title="React hooks" description="Learn hooks" canonical="/tutorials/1/react-hooks" type="article" />);

    await waitFor(() => expect(document.title).toBe('React hooks · YourTuto'));
    expect(document.head.querySelector('meta[name="description"]')).toHaveAttribute('content', 'Learn hooks');
    expect(document.head.querySelector('link[rel="canonical"]'))
      .toHaveAttribute('href', `${window.location.origin}/tutorials/1/react-hooks`);
    expect(document.head.querySelector('meta[property="og:type"]')).toHaveAttribute('content', 'article');
  });

  it('removes the server-rendered data-seo tags to avoid duplicates', async () => {
    const stale = document.createElement('meta');
    stale.setAttribute('data-seo', '');
    stale.setAttribute('name', 'description');
    document.head.appendChild(stale);

    render(<Seo title="X" description="Y" canonical="/" />);

    await waitFor(() => expect(document.head.querySelector('[data-seo]')).toBeNull());
  });

  it('emits noindex when requested and escapes JSON-LD', () => {
    const { container } = render(
      <Seo title="T" description="D" canonical="/" noindex jsonLd={[{ name: '</script><b>x' }]} />,
    );
    expect(document.head.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex, follow');
    expect(container.querySelector('script[type="application/ld+json"]')?.textContent).not.toContain('</script>');
  });
});
