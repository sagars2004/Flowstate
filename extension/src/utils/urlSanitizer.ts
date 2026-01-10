/**
 * URL sanitization utility
 * Removes query parameters, auth tokens, and personal identifiers from URLs
 */

export function sanitizeURL(url: string): string {
  try {
    const parsed = new URL(url);
    // Return only protocol, hostname, and pathname
    return `${parsed.protocol}//${parsed.hostname}${parsed.pathname}`;
  } catch {
    // Invalid URL - return generic identifier
    return 'invalid-url';
  }
}

export function isDistractingSite(url: string): boolean {
  const distractingDomains = [
    'twitter.com',
    'x.com',
    'facebook.com',
    'instagram.com',
    'reddit.com',
    'youtube.com',
    'tiktok.com',
    'linkedin.com',
    'pinterest.com',
  ];

  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    return distractingDomains.some((domain) => hostname.includes(domain));
  } catch {
    return false;
  }
}

export function isProductiveSite(url: string): boolean {
  const productiveDomains = [
    'github.com',
    'stackoverflow.com',
    'docs.google.com',
    'notion.so',
    'figma.com',
    'linear.app',
    'asana.com',
    'trello.com',
  ];

  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    return productiveDomains.some((domain) => hostname.includes(domain));
  } catch {
    return false;
  }
}
