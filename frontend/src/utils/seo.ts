type SeoOptions = {
  title: string;
  description: string;
  path?: string;
  type?: string;
  image?: string;
  structuredData?: Record<string, unknown>;
};

const DEFAULT_SITE_NAME = 'IRRExplorer';
const DEFAULT_SITE_URL =
  import.meta.env.VITE_SITE_URL || 'https://irrexplorer.rxtx.nl';
const DEFAULT_IMAGE = '/logo.png';

function getAbsoluteUrl(path = '/'): string {
  const siteUrl = DEFAULT_SITE_URL.replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${siteUrl}${normalizedPath}`;
}

function upsertMeta(
  selector: string,
  attributes: Record<string, string>,
  content: string
) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement('meta');
    Object.entries(attributes).forEach(([key, value]) => {
      element?.setAttribute(key, value);
    });
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

function upsertCanonical(href: string) {
  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.setAttribute('rel', 'canonical');
    document.head.appendChild(canonical);
  }
  canonical.setAttribute('href', href);
}

function upsertStructuredData(data: Record<string, unknown>) {
  const id = 'seo-structured-data';
  let script = document.getElementById(id) as HTMLScriptElement | null;
  if (!script) {
    script = document.createElement('script');
    script.id = id;
    script.type = 'application/ld+json';
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(data);
}

export function setSeo({
  title,
  description,
  path = '/',
  type = 'website',
  image = DEFAULT_IMAGE,
  structuredData,
}: SeoOptions) {
  const canonicalUrl = getAbsoluteUrl(path);
  const imageUrl = image.startsWith('http') ? image : getAbsoluteUrl(image);

  document.title = title;
  upsertCanonical(canonicalUrl);
  upsertMeta('meta[name="description"]', { name: 'description' }, description);
  upsertMeta('meta[property="og:type"]', { property: 'og:type' }, type);
  upsertMeta('meta[property="og:site_name"]', { property: 'og:site_name' }, DEFAULT_SITE_NAME);
  upsertMeta('meta[property="og:title"]', { property: 'og:title' }, title);
  upsertMeta('meta[property="og:description"]', { property: 'og:description' }, description);
  upsertMeta('meta[property="og:url"]', { property: 'og:url' }, canonicalUrl);
  upsertMeta('meta[property="og:image"]', { property: 'og:image' }, imageUrl);
  upsertMeta('meta[name="twitter:card"]', { name: 'twitter:card' }, 'summary_large_image');
  upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title' }, title);
  upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description' }, description);
  upsertMeta('meta[name="twitter:image"]', { name: 'twitter:image' }, imageUrl);

  if (structuredData) {
    upsertStructuredData(structuredData);
  }
}

export function getWebsiteStructuredData() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: DEFAULT_SITE_NAME,
    url: getAbsoluteUrl('/'),
    description:
      'Investigate prefixes, ASNs, route objects, BGP visibility, and RPKI state with IRRExplorer.',
    potentialAction: {
      '@type': 'SearchAction',
      target: `${getAbsoluteUrl('/query/')}{search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}
