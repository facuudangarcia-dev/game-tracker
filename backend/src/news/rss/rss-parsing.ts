import { createHash } from 'node:crypto';
import { XMLParser } from 'fast-xml-parser';
import type { NewsArticle, NewsCategory } from '../news-provider';

const MAX_TITLE_LENGTH = 200;
const MAX_SUMMARY_LENGTH = 280;
const MAX_SOURCE_LENGTH = 60;
const MAX_ITEMS_PER_FEED = 50;
const MAX_URL_LENGTH = 2000;

/**
 * Keywords of each platform family, matched on the title and the feed's own
 * categories (decision #67). An article can be in several; none = general.
 */
const CATEGORY_PATTERNS: Record<NewsCategory, RegExp> = {
  playstation: /\b(playstation|ps[1-5]|ps vita|psvr ?2?|ps plus|dualsense|sony interactive)\b/i,
  xbox: /\b(xbox|game pass|series [xs]|xbox one)\b/i,
  nintendo: /\b(nintendo|switch( 2)?|wii ?u?|3ds|joy-con|game boy)\b/i,
  pc: /\b(pc|steam|steam deck|epic games store|gog|windows)\b/i,
};

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  processEntities: true,
  htmlEntities: true,
  isArray: (name) =>
    ['item', 'entry', 'category', 'link', 'media:content', 'enclosure'].includes(name),
});

type Node = Record<string, unknown>;

function isNode(value: unknown): value is Node {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asArray(value: unknown): unknown[] {
  return value === undefined || value === null ? [] : Array.isArray(value) ? value : [value];
}

/** Text of an element, whether it's a plain string or has attributes. */
function textOf(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number') {
    return String(value);
  }
  if (isNode(value) && value['#text'] !== undefined) {
    return textOf(value['#text']);
  }
  return '';
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  hellip: '…',
  laquo: '«',
  raquo: '»',
  ldquo: '“',
  rdquo: '”',
  lsquo: '‘',
  rsquo: '’',
  ndash: '–',
  mdash: '—',
};

/** Decodes the HTML entities left in CDATA sections (&#x20;, &amp;, ...). */
export function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === '#') {
      const code =
        entity[1] === 'x' || entity[1] === 'X'
          ? parseInt(entity.slice(2), 16)
          : parseInt(entity.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : '';
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

/** Plain text of an HTML fragment: no tags, scripts or styles; collapsed spaces. */
export function plainText(html: string): string {
  return decodeEntities(
    html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]*>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim();
}

/** Cuts at a word boundary, adding an ellipsis when cut. */
export function truncate(value: string, max: number): string {
  if (value.length <= max) {
    return value;
  }
  const cut = value.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.5 ? cut.slice(0, space) : cut).replace(/[\s.,;:]+$/, '')}…`;
}

/** Absolute http(s) URL (relative ones resolved against the feed), else null. */
export function absoluteUrl(value: string, base: string, httpsOnly = false): string | null {
  const trimmed = decodeEntities(value.trim());
  if (!trimmed || trimmed.length > MAX_URL_LENGTH) {
    return null;
  }
  try {
    const url = new URL(trimmed, base);
    const allowed = httpsOnly ? ['https:'] : ['https:', 'http:'];
    return allowed.includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

/** URL used to detect the same article twice (no query, hash nor trailing slash). */
export function canonicalUrl(url: string): string {
  const parsed = new URL(url);
  return `${parsed.hostname.replace(/^www\./, '').toLowerCase()}${parsed.pathname.replace(/\/+$/, '')}`;
}

/** Title used to detect the same story twice (no accents, punctuation nor case). */
export function normalizedTitle(title: string): string {
  return title
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function categorize(title: string, feedCategories: string[]): NewsCategory[] {
  const haystack = [title, ...feedCategories].join(' \n ');
  return (Object.keys(CATEGORY_PATTERNS) as NewsCategory[]).filter((category) =>
    CATEGORY_PATTERNS[category].test(haystack),
  );
}

function firstImageInHtml(html: string): string | null {
  const match = /<img[^>]+src=["']([^"']+)["']/i.exec(html);
  return match ? match[1] : null;
}

function imageOf(item: Node, html: string, base: string): string | null {
  const candidates: string[] = [];
  const media = [
    ...asArray(item['media:content']),
    ...asArray(isNode(item['media:group']) ? item['media:group']['media:content'] : undefined),
  ];
  for (const entry of media) {
    if (isNode(entry) && typeof entry['@_url'] === 'string') {
      const medium = entry['@_medium'];
      const type = entry['@_type'];
      if (
        medium === 'image' ||
        (typeof type === 'string' && type.startsWith('image/')) ||
        (medium === undefined && type === undefined)
      ) {
        candidates.push(entry['@_url']);
      }
    }
  }
  const thumbnail = item['media:thumbnail'];
  for (const entry of asArray(thumbnail)) {
    if (isNode(entry) && typeof entry['@_url'] === 'string') {
      candidates.push(entry['@_url']);
    }
  }
  for (const entry of asArray(item.enclosure)) {
    if (
      isNode(entry) &&
      typeof entry['@_url'] === 'string' &&
      typeof entry['@_type'] === 'string' &&
      entry['@_type'].startsWith('image/')
    ) {
      candidates.push(entry['@_url']);
    }
  }
  const inline = firstImageInHtml(html);
  if (inline) {
    candidates.push(inline);
  }
  for (const candidate of candidates) {
    // Only https images: http ones would be blocked as mixed content.
    const url = absoluteUrl(candidate, base, true);
    if (url) {
      return url;
    }
  }
  return null;
}

function linkOf(item: Node, base: string): string | null {
  for (const link of asArray(item.link)) {
    // RSS: <link>url</link>. Atom: <link href="url" rel="alternate"/>.
    if (typeof link === 'string') {
      const url = absoluteUrl(link, base);
      if (url) {
        return url;
      }
    } else if (isNode(link) && typeof link['@_href'] === 'string') {
      const rel = link['@_rel'];
      if (rel === undefined || rel === 'alternate') {
        const url = absoluteUrl(link['@_href'], base);
        if (url) {
          return url;
        }
      }
    }
  }
  const guid = item.guid;
  const permalink = isNode(guid) ? guid['@_isPermaLink'] !== 'false' : true;
  return permalink && textOf(guid) ? absoluteUrl(textOf(guid), base) : null;
}

function dateOf(item: Node): string | null {
  for (const field of ['pubDate', 'dc:date', 'published', 'updated']) {
    const value = textOf(item[field]);
    const time = value ? Date.parse(value) : Number.NaN;
    if (!Number.isNaN(time)) {
      return new Date(time).toISOString();
    }
  }
  return null;
}

function categoriesOf(item: Node): string[] {
  return asArray(item.category)
    .map((category) =>
      isNode(category) && typeof category['@_term'] === 'string'
        ? category['@_term']
        : textOf(category),
    )
    .map((category) => decodeEntities(category).trim())
    .filter(Boolean);
}

/**
 * Parses an RSS 2.0 or Atom document into articles. Items without a title, a
 * valid link or a date are dropped; at most 50 per feed. Documents declaring
 * entities are rejected (no entity expansion tricks).
 */
export function parseFeed(xml: string, feedUrl: string, now = new Date()): NewsArticle[] {
  if (/<!ENTITY/i.test(xml)) {
    throw new Error('Feeds declaring entities are not accepted');
  }
  const document = parser.parse(xml) as Node;
  const rss = isNode(document.rss) ? document.rss : null;
  const channel = rss && isNode(rss.channel) ? rss.channel : null;
  const atom = isNode(document.feed) ? document.feed : null;
  const rdf = isNode(document['rdf:RDF']) ? document['rdf:RDF'] : null;
  const container = channel ?? atom ?? rdf;
  if (!container) {
    throw new Error('Not an RSS or Atom document');
  }
  const items = asArray(channel ? channel.item : atom ? atom.entry : rdf?.item);
  const host = new URL(feedUrl).hostname.replace(/^www\./, '');
  const source = truncate(plainText(textOf(container.title)) || host, MAX_SOURCE_LENGTH);
  // Dates far in the future are feed mistakes: they'd stick to the top.
  const latest = now.getTime() + 24 * 60 * 60 * 1000;

  const articles: NewsArticle[] = [];
  for (const item of items.slice(0, MAX_ITEMS_PER_FEED)) {
    if (!isNode(item)) {
      continue;
    }
    const title = truncate(plainText(textOf(item.title)), MAX_TITLE_LENGTH);
    const url = linkOf(item, feedUrl);
    const publishedAt = dateOf(item);
    if (!title || !url || !publishedAt || Date.parse(publishedAt) > latest) {
      continue;
    }
    const html =
      [item.description, item['content:encoded'], item.summary, item.content]
        .map(textOf)
        .find((value) => value.trim() !== '') ?? '';
    const summary = truncate(plainText(html), MAX_SUMMARY_LENGTH);
    articles.push({
      id: createHash('sha256').update(canonicalUrl(url)).digest('hex').slice(0, 24),
      title,
      summary: summary || null,
      url,
      imageUrl: imageOf(item, html, feedUrl),
      source,
      publishedAt,
      categories: categorize(title, categoriesOf(item)),
    });
  }
  return articles;
}

/**
 * Newest first, without duplicates: the same link, or the same title (the same
 * story syndicated by several outlets), keeps only its first appearance.
 */
export function mergeArticles(lists: NewsArticle[][]): NewsArticle[] {
  const sorted = lists.flat().sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();
  const result: NewsArticle[] = [];
  for (const article of sorted) {
    const url = canonicalUrl(article.url);
    const title = normalizedTitle(article.title);
    if (seenUrls.has(url) || seenTitles.has(title)) {
      continue;
    }
    seenUrls.add(url);
    seenTitles.add(title);
    result.push(article);
  }
  return result;
}
