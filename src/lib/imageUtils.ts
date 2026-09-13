import { getSupabasePublicUrl, isSupabaseConfigured } from './supabaseClient';

export const DEFAULT_FALLBACK_AVATAR =
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80';

/**
 * Checks if a string is a temporary, ephemeral browser blob or local filesystem path
 * (e.g. blob:, file:, C:\, /Users/, /home/).
 * These MUST NEVER be saved to the database.
 */
export function isTemporaryBlobUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  return (
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('file:') ||
    /^[a-zA-Z]:[\\/]/.test(trimmed) ||
    trimmed.startsWith('/Users/') ||
    trimmed.startsWith('/home/') ||
    trimmed.startsWith('C:\\')
  );
}

/**
 * Validates whether an avatar reference is acceptable for persistence.
 * Case 1: Valid HTTP / HTTPS URL (e.g., https://example.com/character.jpg)
 * Case 2: Server / Supabase Storage path/reference (e.g., /storage/characters/..., characters/..., avatars/...)
 * Case 3: Rejects blob: URLs, local file paths, or empty strings.
 */
export function isValidCharacterImage(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;

  // Case 3: Reject temporary blobs
  if (isTemporaryBlobUrl(trimmed)) return false;

  // Case 1: Web HTTP/HTTPS URLs
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return true;
  }

  // Case 2: Storage paths and references
  if (trimmed.startsWith('/storage/')) {
    return true;
  }

  if (
    trimmed.startsWith('characters/') ||
    trimmed.startsWith('avatars/') ||
    trimmed.startsWith('covers/') ||
    trimmed.startsWith('music/')
  ) {
    return true;
  }

  return false;
}

/**
 * Normalizes an image reference to a persistent, canonical storage reference to save in database/catalog.
 * This guarantees we NEVER save a temporary blob: URL into the database.
 * - HTTP/HTTPS URL -> returns trimmed URL
 * - Storage path (/storage/...) -> returns canonical trimmed path
 * - Storage reference (characters/...) -> returns canonical /storage/characters/... path (or Supabase public URL)
 * - Temporary blob/file -> returns empty string (reject)
 */
export function normalizePersistentImageReference(url?: string | null): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed || isTemporaryBlobUrl(trimmed)) return '';

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  if (trimmed.startsWith('/storage/')) {
    return trimmed;
  }

  if (trimmed.startsWith('characters/')) {
    const relative = trimmed.slice('characters/'.length);
    if (isSupabaseConfigured()) {
      return getSupabasePublicUrl('characters', relative);
    }
    return `/storage/characters/${relative}`;
  }

  if (trimmed.startsWith('avatars/')) {
    const relative = trimmed.slice('avatars/'.length);
    if (isSupabaseConfigured()) {
      return getSupabasePublicUrl('avatars', relative);
    }
    return `/storage/avatars/${relative}`;
  }

  if (trimmed.includes('/')) {
    const [bucket, ...parts] = trimmed.split('/');
    const relative = parts.join('/');
    if (['characters', 'avatars', 'music-covers', 'music'].includes(bucket)) {
      if (isSupabaseConfigured()) {
        return getSupabasePublicUrl(bucket, relative);
      }
      return `/storage/${bucket}/${relative}`;
    }
  }

  return trimmed;
}

/**
 * Resolves any character avatar reference (full URL, relative storage path, or fallback)
 * to a persistent, renderable URL for <img src="...">.
 * NEVER returns a blob: URL.
 */
export function resolveCharacterImageUrl(avatar?: string | null): string {
  if (!avatar || typeof avatar !== 'string') {
    return DEFAULT_FALLBACK_AVATAR;
  }

  const trimmed = avatar.trim();
  if (!trimmed) {
    return DEFAULT_FALLBACK_AVATAR;
  }

  // Reject temporary browser blobs or local file paths for persistent rendering
  if (isTemporaryBlobUrl(trimmed)) {
    return DEFAULT_FALLBACK_AVATAR;
  }

  // Already a full external or Supabase public URL
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  // Local server storage path: served directly by server
  if (trimmed.startsWith('/storage/')) {
    return trimmed;
  }

  // Relative path within storage bucket
  if (trimmed.startsWith('characters/')) {
    const relative = trimmed.slice('characters/'.length);
    if (isSupabaseConfigured()) {
      return getSupabasePublicUrl('characters', relative);
    }
    return `/storage/characters/${relative}`;
  }

  if (trimmed.startsWith('avatars/')) {
    const relative = trimmed.slice('avatars/'.length);
    if (isSupabaseConfigured()) {
      return getSupabasePublicUrl('avatars', relative);
    }
    return `/storage/avatars/${relative}`;
  }

  if (trimmed.includes('/')) {
    const [bucket, ...parts] = trimmed.split('/');
    const relative = parts.join('/');
    if (['characters', 'avatars', 'music-covers', 'music'].includes(bucket)) {
      if (isSupabaseConfigured()) {
        return getSupabasePublicUrl(bucket, relative);
      }
      return `/storage/${bucket}/${relative}`;
    }
  }

  return trimmed || DEFAULT_FALLBACK_AVATAR;
}

/**
 * Removes redundant presentation headings/labels like "Mô tả:", "Giới thiệu:", "Mô Tả / Giới Thiệu:"
 * from character descriptions so they render cleanly on cards without redundant labels.
 */
export function stripDescriptionHeading(text?: string | null): string {
  if (!text || typeof text !== 'string') return '';
  let cleaned = text.trim();
  // Strip leading label such as "Mô tả:", "Mô tả / Giới thiệu:", "Giới thiệu:", "Mô tả\n", "Giới thiệu\n"
  cleaned = cleaned.replace(/^(mô\s*tả\s*\/?\s*giới\s*thiệu|mô\s*tả|giới\s*thiệu|gioi\s*thieu|mo\s*ta|description|bio)\s*[:：\-–—\n]\s*/i, '');
  cleaned = cleaned.replace(/^(mô\s*tả|giới\s*thiệu|gioi\s*thieu|mo\s*ta)\s*\n+/i, '');
  return cleaned.trim();
}

