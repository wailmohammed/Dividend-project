import { useEffect } from 'react';

interface SeoOptions {
  title: string;
  description: string;
  canonicalPath?: string;
  jsonLd?: Record<string, unknown>;
}

function setMeta(selector: string, attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

/** Sets title, description, OG/Twitter tags, canonical link and optional JSON-LD. */
export function useSeo({ title, description, canonicalPath, jsonLd }: SeoOptions) {
  useEffect(() => {
    document.title = title;
    setMeta('meta[name="description"]', 'name', 'description', description);
    setMeta('meta[property="og:title"]', 'property', 'og:title', title);
    setMeta('meta[property="og:description"]', 'property', 'og:description', description);
    setMeta('meta[property="og:type"]', 'property', 'og:type', 'website');
    setMeta('meta[name="twitter:card"]', 'name', 'twitter:card', 'summary_large_image');

    if (canonicalPath) {
      let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
      if (!link) {
        link = document.createElement('link');
        link.rel = 'canonical';
        document.head.appendChild(link);
      }
      link.href = `${window.location.origin}${canonicalPath}`;
    }

    let script: HTMLScriptElement | null = null;
    if (jsonLd) {
      script = document.createElement('script');
      script.type = 'application/ld+json';
      script.text = JSON.stringify(jsonLd);
      document.head.appendChild(script);
    }

    return () => {
      if (script) script.remove();
    };
  }, [title, description, canonicalPath, JSON.stringify(jsonLd)]);
}
