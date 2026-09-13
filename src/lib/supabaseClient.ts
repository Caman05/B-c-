import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Environment credentials for Supabase (supports VITE_ prefixed or bare env variable names)
const getEnvVar = (key: string): string => {
  if (typeof import.meta !== 'undefined') {
    const metaEnv = (import.meta as { env?: Record<string, string | undefined> }).env;
    if (metaEnv) {
      const val = metaEnv[key];
      if (val && typeof val === 'string' && val.trim()) {
        return val.trim();
      }
    }
  }
  if (typeof process !== 'undefined' && process.env) {
    const val = process.env[key];
    if (val && typeof val === 'string' && val.trim()) {
      return val.trim();
    }
  }
  return '';
};

const getSupabaseUrl = (): string => {
  return (
    getEnvVar('VITE_SUPABASE_URL') ||
    getEnvVar('SUPABASE_URL') ||
    ''
  );
};

const getSupabaseAnonKey = (): string => {
  return (
    getEnvVar('VITE_SUPABASE_ANON_KEY') ||
    getEnvVar('SUPABASE_ANON_KEY') ||
    getEnvVar('SUPABASE_KEY') ||
    ''
  );
};

let cachedClient: SupabaseClient | null = null;

/**
 * Checks if real Supabase project credentials are configured
 */
export function isSupabaseConfigured(): boolean {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  return Boolean(
    url && 
    key && 
    url.startsWith('https://') &&
    !url.includes('placeholder') &&
    !url.includes('MY_SUPABASE')
  );
}

/**
 * Returns diagnostic configuration status for Admin dashboard
 */
export function getSupabaseConfigStatus(): {
  configured: boolean;
  url: string;
  hasKey: boolean;
} {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  return {
    configured: isSupabaseConfigured(),
    url: url ? url.replace(/(https:\/\/[^.]+).*/, '$1.supabase.co') : '',
    hasKey: Boolean(key && key.length > 20),
  };
}

/**
 * Returns the Supabase client instance if configured, or null
 */
export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }
  if (!cachedClient) {
    const url = getSupabaseUrl();
    const key = getSupabaseAnonKey();
    cachedClient = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }
  return cachedClient;
}

/**
 * Upload a binary file or Blob to Supabase Storage bucket
 * Bucket 'music' is used for audio files
 */
export async function uploadToSupabaseStorage(
  bucket: string,
  path: string,
  file: File | Blob,
  contentType: string
): Promise<{ publicUrl: string; path: string; storageBucket: string }> {
  const client = getSupabase();
  if (!client) {
    throw new Error('Supabase client chưa được cấu hình. Cần thiết lập VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY.');
  }

  // Strip leading bucket name if already present in path
  const normalizedPath = path.startsWith(`${bucket}/`) ? path.slice(bucket.length + 1) : path;

  const { data, error } = await client.storage
    .from(bucket)
    .upload(normalizedPath, file, {
      contentType,
      upsert: true,
    });

  if (error) {
    console.error('[Supabase Storage Upload Error]', error);
    throw new Error(`Lỗi tải file lên Supabase Storage (${bucket}/${normalizedPath}): ${error.message}`);
  }

  const { data: publicData } = client.storage.from(bucket).getPublicUrl(data.path);
  return {
    publicUrl: publicData.publicUrl,
    path: `${bucket}/${data.path}`,
    storageBucket: bucket,
  };
}

/**
 * Get permanent public URL for an object in Supabase Storage
 */
export function getSupabasePublicUrl(bucket: string, path: string): string {
  const cleanPath = path.startsWith(`${bucket}/`) ? path.slice(bucket.length + 1) : path;
  const client = getSupabase();
  if (!client) {
    return `/storage/${bucket}/${cleanPath}`;
  }
  const { data } = client.storage.from(bucket).getPublicUrl(cleanPath);
  return data.publicUrl;
}

/**
 * Get signed URL for private bucket in Supabase Storage
 */
export async function getSupabaseSignedUrl(bucket: string, path: string, expiresIn = 3600): Promise<string> {
  const cleanPath = path.startsWith(`${bucket}/`) ? path.slice(bucket.length + 1) : path;
  const client = getSupabase();
  if (!client) {
    return getSupabasePublicUrl(bucket, path);
  }
  const { data, error } = await client.storage.from(bucket).createSignedUrl(cleanPath, expiresIn);
  if (error || !data?.signedUrl) {
    return getSupabasePublicUrl(bucket, path);
  }
  return data.signedUrl;
}

/**
 * Remove an object from Supabase Storage bucket
 */
export async function deleteFromSupabaseStorage(bucket: string, path: string): Promise<boolean> {
  const cleanPath = path.startsWith(`${bucket}/`) ? path.slice(bucket.length + 1) : path;
  const client = getSupabase();
  if (!client) {
    return false;
  }
  try {
    const { error } = await client.storage.from(bucket).remove([cleanPath]);
    if (error) {
      console.warn(`[Supabase Storage Delete Warning] (${bucket}/${cleanPath}):`, error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn(`[Supabase Storage Delete Network Error] (${bucket}/${cleanPath}):`, err);
    return false;
  }
}
