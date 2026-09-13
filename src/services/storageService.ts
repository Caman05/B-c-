/**
 * Storage Service
 * Handles file validation, asset uploads, IndexedDB persistence, and URL resolution for Supabase Storage.
 * Keeps file upload logic completely detached from React UI components.
 */

import { musicService } from './musicService';
import { Track } from '../types';
import { 
  isSupabaseConfigured, 
  uploadToSupabaseStorage, 
  getSupabasePublicUrl,
  deleteFromSupabaseStorage
} from '../lib/supabaseClient';

export interface UploadResult {
  url: string;
  path: string;
  storageBucket: string;
  contentType: string;
  fileName: string;
  fileSize: number;
  duration?: number;
}

export interface StorageRecord {
  key: string;
  bucket: string;
  path: string;
  fileName: string;
  contentType: string;
  fileSize: number;
  data: ArrayBuffer;
  createdAt: string;
  updatedAt: string;
}

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'image/gif'];
const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024; // 8 MB

const ALLOWED_AUDIO_TYPES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/ogg',
  'audio/aac',
  'audio/m4a',
  'audio/mp4',
  'audio/flac',
  'audio/x-m4a',
  'audio/x-wav',
];
const MAX_AUDIO_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

const DB_NAME = 'be_ca_storage_v1';
const DB_STORE = 'objects';

/**
 * Determine exact audio MIME type from filename and reported file type
 */
export function detectAudioMimeType(fileName: string, rawType?: string): string {
  const ext = fileName.toLowerCase().split('.').pop() || '';
  switch (ext) {
    case 'mp3':
      return 'audio/mpeg';
    case 'wav':
      return 'audio/wav';
    case 'ogg':
      return 'audio/ogg';
    case 'm4a':
      return 'audio/mp4';
    case 'aac':
      return 'audio/aac';
    case 'flac':
      return 'audio/flac';
    default:
      if (rawType && rawType.startsWith('audio/')) {
        return rawType;
      }
      return 'audio/mpeg';
  }
}

/**
 * IndexedDB helper for binary storage
 */
let dbPromise: Promise<IDBDatabase> | null = null;

function getStorageDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported in this environment'));
    }

    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (event: any) => {
      const db = event.target.result as IDBDatabase;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

async function putRecord(record: StorageRecord): Promise<void> {
  try {
    const db = await getStorageDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readwrite');
      const store = tx.objectStore(DB_STORE);
      const req = store.put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[StorageService] Failed to persist object into IndexedDB:', err);
  }
}

async function getRecord(key: string): Promise<StorageRecord | null> {
  try {
    const db = await getStorageDB();
    return await new Promise<StorageRecord | null>((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readonly');
      const store = tx.objectStore(DB_STORE);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[StorageService] Failed to read object from IndexedDB:', err);
    return null;
  }
}

class StorageService {
  // In-memory registry of active object URLs for fast access
  private activeObjectUrls = new Map<string, string>();

  /**
   * Validate image file type and size
   */
  public validateImage(file: File): { valid: boolean; error?: string } {
    if (!file) {
      return { valid: false, error: 'Không tìm thấy tệp tin.' };
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.type.toLowerCase())) {
      return {
        valid: false,
        error: `Định dạng hình ảnh không hợp lệ (${file.type || 'không rõ'}). Chỉ chấp nhận PNG, JPEG, WEBP, SVG.`,
      };
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      return {
        valid: false,
        error: `Kích thước tệp quá lớn (${(file.size / (1024 * 1024)).toFixed(1)}MB). Tối đa cho phép: 8MB.`,
      };
    }

    return { valid: true };
  }

  /**
   * Validate audio file type and size
   */
  public validateAudio(file: File): { valid: boolean; error?: string } {
    if (!file) {
      return { valid: false, error: 'Không tìm thấy tệp âm thanh.' };
    }

    // Standard audio MIME types or file extensions
    const isAudioType =
      ALLOWED_AUDIO_TYPES.includes(file.type.toLowerCase()) ||
      /\.(mp3|wav|ogg|aac|m4a|flac)$/i.test(file.name);

    if (!isAudioType) {
      return {
        valid: false,
        error: `Định dạng tệp âm thanh không hợp lệ (${file.type || 'không rõ'}). Chỉ chấp nhận MP3, WAV, OGG, AAC, M4A, FLAC.`,
      };
    }

    if (file.size > MAX_AUDIO_SIZE_BYTES) {
      return {
        valid: false,
        error: `Kích thước tệp âm thanh quá lớn (${(file.size / (1024 * 1024)).toFixed(1)}MB). Tối đa cho phép: 50MB.`,
      };
    }

    return { valid: true };
  }

  /**
   * Upload character avatar image to persistent Supabase Storage
   * Path format: characters/<characterId>/char-<timestamp>-<random>.<ext>
   * Strictly avoids using email in file names or paths.
   */
  public async uploadCharacterImage(file: File, characterId?: string): Promise<UploadResult> {
    if (!musicService.isAdminUser()) {
      throw new Error('Từ chối quyền truy cập: Chỉ Quản trị viên (Admin) mới có quyền tải lên hình ảnh nhân vật.');
    }

    const check = this.validateImage(file);
    if (!check.valid) {
      throw new Error(check.error || 'Tệp ảnh không hợp lệ.');
    }

    // Sanitize characterId (letters, numbers, dashes, underscores only)
    const safeCharId = characterId ? characterId.trim().replace(/[^a-zA-Z0-9_-]/g, '_') : 'catalog';
    const rawExt = file.name.split('.').pop()?.toLowerCase() || 'png';
    const fileExt = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(rawExt) ? rawExt : 'png';
    const cleanFileName = `char-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
    const storagePath = `characters/${safeCharId}/${cleanFileName}`;
    const contentType = file.type || (fileExt === 'png' ? 'image/png' : 'image/jpeg');

    let persistentUrl = '';
    let bucketUsed = 'characters';

    // 1. If Supabase is configured with real credentials, upload to Supabase Storage
    if (isSupabaseConfigured()) {
      try {
        const uploadRes = await uploadToSupabaseStorage('characters', storagePath, file, contentType);
        bucketUsed = 'characters';
        persistentUrl = uploadRes.publicUrl || getSupabasePublicUrl('characters', storagePath);
      } catch (charErr: any) {
        console.warn('[StorageService] characters bucket upload error:', charErr?.message || charErr);
        // If 'characters' bucket is not yet provisioned in Supabase, gracefully fallback to 'avatars' or 'music-covers'
        try {
          bucketUsed = 'avatars';
          const fallbackPath = `characters/${safeCharId}/${cleanFileName}`;
          const fallbackRes = await uploadToSupabaseStorage('avatars', fallbackPath, file, contentType);
          persistentUrl = fallbackRes.publicUrl || getSupabasePublicUrl('avatars', fallbackPath);
        } catch (covErr: any) {
          console.warn('[StorageService] avatars fallback failed, attempting music-covers fallback:', covErr?.message || covErr);
          try {
            bucketUsed = 'music-covers';
            const fallbackPath = `characters/${safeCharId}/${cleanFileName}`;
            const fallbackRes = await uploadToSupabaseStorage('music-covers', fallbackPath, file, contentType);
            persistentUrl = fallbackRes.publicUrl || getSupabasePublicUrl('music-covers', fallbackPath);
          } catch (finalCovErr: any) {
            console.warn('[StorageService] All Supabase storage attempts failed, falling back to local server storage:', finalCovErr?.message || finalCovErr);
          }
        }
      }
    }

    // 2. If not uploaded to Supabase or persistentUrl still empty, upload to persistent local server storage endpoint
    if (!persistentUrl) {
      bucketUsed = 'characters';
      try {
        const uploadRes = await fetch('/api/storage/upload', {
          method: 'POST',
          headers: {
            'x-storage-bucket': bucketUsed,
            'x-file-name': `${safeCharId}_${cleanFileName}`,
            'Content-Type': contentType,
          },
          body: file,
        });
        if (uploadRes.ok) {
          const json = await uploadRes.json();
          persistentUrl = json.url || `/storage/${bucketUsed}/${safeCharId}_${cleanFileName}`;
        } else {
          persistentUrl = `/storage/${bucketUsed}/${safeCharId}_${cleanFileName}`;
        }
      } catch {
        persistentUrl = `/storage/${bucketUsed}/${safeCharId}_${cleanFileName}`;
      }
    }

    if (!persistentUrl) {
      persistentUrl = isSupabaseConfigured()
        ? getSupabasePublicUrl(bucketUsed, storagePath)
        : `/storage/${bucketUsed}/${safeCharId}_${cleanFileName}`;
    }

    // Secondary IndexedDB cache for offline/instant local retrieval across restarts and reloads
    try {
      const buffer = await file.arrayBuffer();
      const flatName = `${safeCharId}_${cleanFileName}`;
      
      // Save under persistent URL key
      await putRecord({
        key: persistentUrl,
        bucket: bucketUsed,
        path: storagePath,
        fileName: flatName,
        contentType,
        fileSize: file.size,
        data: buffer,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Save under bucket:path key
      await putRecord({
        key: `${bucketUsed}:${storagePath}`,
        bucket: bucketUsed,
        path: storagePath,
        fileName: flatName,
        contentType,
        fileSize: file.size,
        data: buffer,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Save under flat file name key
      await putRecord({
        key: flatName,
        bucket: bucketUsed,
        path: storagePath,
        fileName: flatName,
        contentType,
        fileSize: file.size,
        data: buffer,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Populate in-memory active image cache for instantaneous render
      const blob = new Blob([buffer], { type: contentType });
      const activeBlobUrl = URL.createObjectURL(blob);
      this.activeObjectUrls.set(persistentUrl, activeBlobUrl);
      this.activeObjectUrls.set(storagePath, activeBlobUrl);
      this.activeObjectUrls.set(flatName, activeBlobUrl);
      this.activeObjectUrls.set(cleanFileName, activeBlobUrl);
    } catch (cacheErr) {
      console.warn('[StorageService] IndexedDB cache warning:', cacheErr);
    }

    console.log('[StorageService Character Image Uploaded]', {
      bucket: bucketUsed,
      path: storagePath,
      fileName: file.name,
      contentType,
      sizeBytes: file.size,
      persistentUrl,
    });

    return {
      url: persistentUrl,
      path: storagePath,
      storageBucket: bucketUsed,
      contentType,
      fileName: file.name,
      fileSize: file.size,
    };
  }

  /**
   * Preload character images from IndexedDB cache to ensure instant offline & post-reload availability
   */
  public async preloadCharacterImages(): Promise<void> {
    try {
      const db = await getStorageDB().catch(() => null);
      if (!db) return;

      await new Promise<void>((resolve) => {
        try {
          const tx = db.transaction(DB_STORE, 'readonly');
          const store = tx.objectStore(DB_STORE);
          const req = store.openCursor();
          req.onsuccess = (e: any) => {
            const cursor = e.target.result;
            if (cursor) {
              const val = cursor.value as StorageRecord;
              if (val && val.data && val.data.byteLength > 0) {
                const isChar = val.bucket === 'characters' ||
                  val.key?.includes('characters') ||
                  val.key?.startsWith('/storage/characters') ||
                  val.path?.includes('characters');
                if (isChar) {
                  const cType = val.contentType || 'image/jpeg';
                  const blob = new Blob([val.data], { type: cType });
                  const blobUrl = URL.createObjectURL(blob);
                  if (val.key) this.activeObjectUrls.set(val.key, blobUrl);
                  if (val.path) this.activeObjectUrls.set(val.path, blobUrl);
                  if (val.fileName) {
                    this.activeObjectUrls.set(val.fileName, blobUrl);
                    this.activeObjectUrls.set(`/storage/characters/${val.fileName}`, blobUrl);
                  }
                }
              }
              cursor.continue();
            } else {
              resolve();
            }
          };
          req.onerror = () => resolve();
        } catch {
          resolve();
        }
      });
    } catch (e) {
      console.warn('[StorageService] preloadCharacterImages warning:', e);
    }
  }

  /**
   * Resolve an image URL from IndexedDB cache if server / network request failed
   */
  public async resolveCharacterImageFallback(urlOrPath: string): Promise<string | null> {
    if (!urlOrPath || typeof urlOrPath !== 'string') return null;
    const trimmed = urlOrPath.trim();
    if (!trimmed) return null;

    // 1. Check in-memory cache
    if (this.activeObjectUrls.has(trimmed)) {
      return this.activeObjectUrls.get(trimmed)!;
    }

    const cleanName = trimmed
      .replace(/^\/storage\/characters\//, '')
      .replace(/^characters\//, '');

    if (this.activeObjectUrls.has(cleanName)) {
      return this.activeObjectUrls.get(cleanName)!;
    }

    // 2. Try direct keys in IndexedDB
    const possibleKeys = [
      trimmed,
      `characters:${trimmed}`,
      `/storage/characters/${cleanName}`,
      `characters:${cleanName}`,
      `characters:characters/${cleanName}`,
      cleanName,
    ];

    for (const k of possibleKeys) {
      const rec = await getRecord(k);
      if (rec && rec.data && rec.data.byteLength > 0) {
        const cType = rec.contentType || 'image/jpeg';
        const blob = new Blob([rec.data], { type: cType });
        const blobUrl = URL.createObjectURL(blob);
        this.activeObjectUrls.set(trimmed, blobUrl);
        this.activeObjectUrls.set(cleanName, blobUrl);
        return blobUrl;
      }
    }

    // 3. Scan IndexedDB for matching record
    const db = await getStorageDB().catch(() => null);
    if (db) {
      const record = await new Promise<StorageRecord | null>((resolve) => {
        try {
          const tx = db.transaction(DB_STORE, 'readonly');
          const store = tx.objectStore(DB_STORE);
          const req = store.openCursor();
          req.onsuccess = (e: any) => {
            const cursor = e.target.result;
            if (cursor) {
              const val = cursor.value as StorageRecord;
              if (
                val &&
                val.data &&
                val.data.byteLength > 0 &&
                (val.fileName === cleanName ||
                  val.path?.includes(cleanName) ||
                  val.key?.includes(cleanName))
              ) {
                return resolve(val);
              }
              cursor.continue();
            } else {
              resolve(null);
            }
          };
          req.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      });

      if (record && record.data && record.data.byteLength > 0) {
        const cType = record.contentType || 'image/jpeg';
        const blob = new Blob([record.data], { type: cType });
        const blobUrl = URL.createObjectURL(blob);
        this.activeObjectUrls.set(trimmed, blobUrl);
        this.activeObjectUrls.set(cleanName, blobUrl);
        return blobUrl;
      }
    }

    return null;
  }

  /**
   * Synchronous check for active object URL from in-memory cache
   */
  public getActiveImageUrl(urlOrPath: string): string | null {
    if (!urlOrPath) return null;
    if (this.activeObjectUrls.has(urlOrPath)) {
      return this.activeObjectUrls.get(urlOrPath)!;
    }
    const cleanName = urlOrPath
      .replace(/^\/storage\/characters\//, '')
      .replace(/^characters\//, '');
    if (this.activeObjectUrls.has(cleanName)) {
      return this.activeObjectUrls.get(cleanName)!;
    }
    return null;
  }

  /**
   * Upload music cover art image
   */
  public async uploadMusicCover(file: File): Promise<UploadResult> {
    if (!musicService.isAdminUser()) {
      throw new Error('Từ chối quyền truy cập: Chỉ Quản trị viên (Admin) mới có quyền tải lên ảnh bìa bài hát.');
    }

    const check = this.validateImage(file);
    if (!check.valid) {
      throw new Error(check.error);
    }

    const fileExt = file.name.split('.').pop() || 'png';
    const cleanFileName = `cover-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
    const storagePath = `covers/${cleanFileName}`;
    const contentType = file.type || 'image/png';

    let persistentUrl = '';
    let bucketUsed = 'music-covers';

    // 1. If Supabase is configured with real credentials, upload to Supabase Storage
    if (isSupabaseConfigured()) {
      try {
        const uploadRes = await uploadToSupabaseStorage('music-covers', storagePath, file, contentType);
        bucketUsed = 'music-covers';
        persistentUrl = uploadRes.publicUrl || getSupabasePublicUrl('music-covers', storagePath);
      } catch (covErr: any) {
        const msg = (covErr?.message || '').toLowerCase();
        // If music-covers bucket is not found or fails RLS, fallback to the existing 'music' bucket in covers/ folder
        if (msg.includes('not found') || msg.includes('bucket') || msg.includes('row-level security') || msg.includes('rls')) {
          console.warn('[StorageService] music-covers bucket unavailable, falling back to existing music bucket:', covErr.message);
          bucketUsed = 'music';
          const fallbackRes = await uploadToSupabaseStorage('music', storagePath, file, contentType);
          persistentUrl = fallbackRes.publicUrl || getSupabasePublicUrl('music', storagePath);
        } else {
          throw covErr;
        }
      }
    } else {
      // 2. Upload to persistent local dev server storage endpoint
      try {
        const uploadRes = await fetch('/api/storage/upload', {
          method: 'POST',
          headers: {
            'x-storage-bucket': bucketUsed,
            'x-file-name': cleanFileName,
            'Content-Type': contentType,
          },
          body: file,
        });
        if (uploadRes.ok) {
          const json = await uploadRes.json();
          persistentUrl = json.url || `/storage/${bucketUsed}/${cleanFileName}`;
        } else {
          persistentUrl = `/storage/${bucketUsed}/${cleanFileName}`;
        }
      } catch {
        persistentUrl = `/storage/${bucketUsed}/${cleanFileName}`;
      }
    }

    if (!persistentUrl) {
      persistentUrl = isSupabaseConfigured()
        ? getSupabasePublicUrl(bucketUsed, storagePath)
        : `/storage/${bucketUsed}/${cleanFileName}`;
    }

    // Secondary IndexedDB cache
    const buffer = await file.arrayBuffer();
    const key = `${bucketUsed}:${storagePath}`;
    await putRecord({
      key,
      bucket: bucketUsed,
      path: storagePath,
      fileName: file.name,
      contentType,
      fileSize: file.size,
      data: buffer,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    console.log('[StorageService Cover Uploaded]', {
      bucket: bucketUsed,
      path: storagePath,
      fileName: file.name,
      contentType,
      sizeBytes: file.size,
      persistentUrl,
    });

    return {
      url: persistentUrl,
      path: storagePath,
      storageBucket: bucketUsed,
      contentType,
      fileName: file.name,
      fileSize: file.size,
    };
  }

  /**
   * Upload user or admin avatar image to persistent Supabase Storage
   * Path format: <userId>/avatar-<timestamp>-<random>.<ext>
   * Strictly avoids using email in file names or paths for privacy.
   */
  public async uploadAvatar(file: File, userId: string): Promise<UploadResult> {
    if (!userId || !userId.trim()) {
      throw new Error('Không xác định được danh tính người dùng để tải ảnh đại diện.');
    }

    const check = this.validateImage(file);
    if (!check.valid) {
      throw new Error(check.error || 'Tệp ảnh không hợp lệ.');
    }

    // Sanitize userId (letters, numbers, dashes, underscores only) - never use email
    const safeUserId = userId.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    const rawExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const fileExt = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(rawExt) ? rawExt : 'jpg';
    const cleanFileName = `avatar-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
    const storagePath = `${safeUserId}/${cleanFileName}`;
    const contentType = file.type || 'image/jpeg';

    let persistentUrl = '';
    let bucketUsed = 'avatars';

    // 1. If Supabase is configured with real credentials, upload to Supabase Storage
    if (isSupabaseConfigured()) {
      try {
        const uploadRes = await uploadToSupabaseStorage('avatars', storagePath, file, contentType);
        bucketUsed = 'avatars';
        persistentUrl = uploadRes.publicUrl || getSupabasePublicUrl('avatars', storagePath);
      } catch (covErr: any) {
        const msg = (covErr?.message || '').toLowerCase();
        // If avatars bucket is not yet provisioned, gracefully fallback to music bucket under avatars/ folder
        if (msg.includes('not found') || msg.includes('bucket') || msg.includes('row-level security') || msg.includes('rls')) {
          console.warn('[StorageService] avatars bucket unavailable, falling back to music bucket (avatars/):', covErr.message);
          bucketUsed = 'music';
          const fallbackPath = `avatars/${safeUserId}/${cleanFileName}`;
          const fallbackRes = await uploadToSupabaseStorage('music', fallbackPath, file, contentType);
          persistentUrl = fallbackRes.publicUrl || getSupabasePublicUrl('music', fallbackPath);
        } else {
          throw covErr;
        }
      }
    } else {
      // 2. Local dev server storage fallback
      try {
        const uploadRes = await fetch('/api/storage/upload', {
          method: 'POST',
          headers: {
            'x-storage-bucket': bucketUsed,
            'x-file-name': `${safeUserId}_${cleanFileName}`,
            'Content-Type': contentType,
          },
          body: file,
        });
        if (uploadRes.ok) {
          const json = await uploadRes.json();
          persistentUrl = json.url || `/storage/${bucketUsed}/${safeUserId}/${cleanFileName}`;
        } else {
          persistentUrl = `/storage/${bucketUsed}/${safeUserId}/${cleanFileName}`;
        }
      } catch {
        persistentUrl = `/storage/${bucketUsed}/${safeUserId}/${cleanFileName}`;
      }
    }

    if (!persistentUrl) {
      persistentUrl = isSupabaseConfigured()
        ? getSupabasePublicUrl(bucketUsed, storagePath)
        : `/storage/${bucketUsed}/${safeUserId}/${cleanFileName}`;
    }

    // Secondary IndexedDB cache for offline & quick preview resilience
    try {
      const buffer = await file.arrayBuffer();
      const key = `${bucketUsed}:${storagePath}`;
      await putRecord({
        key,
        bucket: bucketUsed,
        path: storagePath,
        fileName: file.name,
        contentType,
        fileSize: file.size,
        data: buffer,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } catch (dbErr) {
      console.warn('[StorageService] IndexedDB cache warning:', dbErr);
    }

    console.log('[StorageService Avatar Uploaded]', {
      bucket: bucketUsed,
      path: storagePath,
      fileName: file.name,
      contentType,
      sizeBytes: file.size,
      persistentUrl,
    });

    return {
      url: persistentUrl,
      path: storagePath,
      storageBucket: bucketUsed,
      contentType,
      fileName: file.name,
      fileSize: file.size,
    };
  }

  /**
   * Attempt to delete previous avatar from Supabase Storage to avoid orphaned storage objects
   */
  public async deleteOldAvatar(avatarUrl: string, userId?: string): Promise<boolean> {
    if (!avatarUrl || !avatarUrl.startsWith('http')) return false;
    // Don't delete external stock images like Unsplash
    if (avatarUrl.includes('unsplash.com') || avatarUrl.includes('githubusercontent.com') || avatarUrl.includes('dicebear.com')) {
      return false;
    }

    try {
      // Check if it's a Supabase storage URL: .../storage/v1/object/public/<bucket>/<path>
      const match = avatarUrl.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
      if (match) {
        const bucket = match[1];
        const path = match[2];
        // Security check: ensure path contains userId if userId is provided
        if (userId && !path.includes(userId)) {
          console.warn('[StorageService] Refusing to delete avatar of different user:', path);
          return false;
        }
        return await deleteFromSupabaseStorage(bucket, path);
      }
      return false;
    } catch (err) {
      console.warn('[StorageService] Error cleaning up old avatar:', err);
      return false;
    }
  }

  /**
   * Upload audio track to storage with verified MIME type and persistent HTTP URL
   */
  public async uploadMusicAudio(file: File): Promise<UploadResult> {
    if (!musicService.isAdminUser()) {
      throw new Error('Từ chối quyền truy cập: Chỉ Quản trị viên (Admin) mới có quyền tải lên tệp âm thanh.');
    }

    const check = this.validateAudio(file);
    if (!check.valid) {
      throw new Error(check.error);
    }

    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'mp3';
    const cleanFileName = `track-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
    const storagePath = `music/${cleanFileName}`;
    const contentType = detectAudioMimeType(file.name, file.type);

    // Read audio duration using temporary Object URL that is immediately revoked
    let duration = 180;
    try {
      const tempBlobUrl = URL.createObjectURL(file);
      const tempAudio = new Audio();
      tempAudio.src = tempBlobUrl;
      await new Promise<void>((resolve) => {
        const onLoaded = () => {
          if (tempAudio.duration && !isNaN(tempAudio.duration) && isFinite(tempAudio.duration)) {
            duration = Math.round(tempAudio.duration);
          }
          cleanup();
          resolve();
        };
        const onError = () => {
          cleanup();
          resolve();
        };
        const cleanup = () => {
          tempAudio.removeEventListener('loadedmetadata', onLoaded);
          tempAudio.removeEventListener('error', onError);
          URL.revokeObjectURL(tempBlobUrl);
        };
        tempAudio.addEventListener('loadedmetadata', onLoaded);
        tempAudio.addEventListener('error', onError);
        setTimeout(() => {
          cleanup();
          resolve();
        }, 1200);
      });
    } catch {
      // duration fallback
    }

    let persistentUrl = '';

    // 1. If Supabase is configured with real credentials, upload to Supabase Storage
    if (isSupabaseConfigured()) {
      const uploadRes = await uploadToSupabaseStorage('music', storagePath, file, contentType);
      persistentUrl = uploadRes.publicUrl || getSupabasePublicUrl('music', storagePath);
    } else {
      // 2. Upload to persistent local dev server storage endpoint
      try {
        const uploadRes = await fetch('/api/storage/upload', {
          method: 'POST',
          headers: {
            'x-storage-bucket': 'music',
            'x-file-name': cleanFileName,
            'Content-Type': contentType,
          },
          body: file,
        });
        if (uploadRes.ok) {
          const json = await uploadRes.json();
          persistentUrl = json.url || `/storage/music/${cleanFileName}`;
        } else {
          persistentUrl = `/storage/music/${cleanFileName}`;
        }
      } catch {
        persistentUrl = `/storage/music/${cleanFileName}`;
      }
    }

    if (!persistentUrl) {
      persistentUrl = isSupabaseConfigured()
        ? getSupabasePublicUrl('music', storagePath)
        : `/storage/music/${cleanFileName}`;
    }

    // Secondary IndexedDB persistence for offline/backup
    const buffer = await file.arrayBuffer();
    const key = `music:${storagePath}`;
    await putRecord({
      key,
      bucket: 'music',
      path: storagePath,
      fileName: file.name,
      contentType,
      fileSize: file.size,
      data: buffer,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Log in development as per Patch requirements
    console.log('[StorageService Audio Uploaded]', {
      bucket: 'music',
      path: storagePath,
      fileName: file.name,
      contentType,
      sizeBytes: file.size,
      duration,
      persistentUrl,
    });

    return {
      url: persistentUrl,
      path: storagePath,
      storageBucket: 'music',
      contentType,
      fileName: file.name,
      fileSize: file.size,
      duration,
    };
  }

  /**
   * Attempt to find and recover binary audio from client-side IndexedDB
   */
  public async getAudioFromIndexedDB(
    fileNameOrPath: string
  ): Promise<{ blobUrl: string; contentType: string; buffer: ArrayBuffer } | null> {
    try {
      const cleanName = fileNameOrPath
        .replace(/^https?:\/\/[^/]+/, '')
        .replace(/^\/storage\/music\//, '')
        .replace(/^music\/(audio\/)?/, '');

      // Check in-memory object URL cache first
      const cached = this.activeObjectUrls.get(cleanName);
      if (cached) {
        return { blobUrl: cached, contentType: 'audio/mpeg', buffer: new ArrayBuffer(0) };
      }

      // 1. Try direct keys
      const possibleKeys = [
        `music:${fileNameOrPath}`,
        `music:music/${cleanName}`,
        `music:${cleanName}`,
        fileNameOrPath,
        cleanName,
      ];

      for (const k of possibleKeys) {
        const rec = await getRecord(k);
        if (rec && rec.data && rec.data.byteLength > 0) {
          const cType = rec.contentType || 'audio/mpeg';
          const blob = new Blob([rec.data], { type: cType });
          const blobUrl = URL.createObjectURL(blob);
          this.activeObjectUrls.set(cleanName, blobUrl);
          return { blobUrl, contentType: cType, buffer: rec.data };
        }
      }

      // 2. Scan IndexedDB store for record matching fileName or path
      const db = await getStorageDB().catch(() => null);
      if (db) {
        const record = await new Promise<StorageRecord | null>((resolve) => {
          try {
            const tx = db.transaction(DB_STORE, 'readonly');
            const store = tx.objectStore(DB_STORE);
            const req = store.openCursor();
            req.onsuccess = (e: any) => {
              const cursor = e.target.result;
              if (cursor) {
                const val = cursor.value as StorageRecord;
                if (
                  val &&
                  val.data &&
                  val.data.byteLength > 0 &&
                  (val.fileName === cleanName ||
                    val.path?.includes(cleanName) ||
                    val.key?.includes(cleanName))
                ) {
                  return resolve(val);
                }
                cursor.continue();
              } else {
                resolve(null);
              }
            };
            req.onerror = () => resolve(null);
          } catch {
            resolve(null);
          }
        });

        if (record && record.data && record.data.byteLength > 0) {
          const cType = record.contentType || 'audio/mpeg';
          const blob = new Blob([record.data], { type: cType });
          const blobUrl = URL.createObjectURL(blob);
          this.activeObjectUrls.set(cleanName, blobUrl);
          return { blobUrl, contentType: cType, buffer: record.data };
        }
      }
    } catch (e) {
      console.warn('[StorageService] IndexedDB recovery lookup failed:', e);
    }
    return null;
  }

  /**
   * Resolve playable URL for a track (supports persistent Supabase Storage, local server, & IndexedDB recovery)
   */
  public async getPlayableAudioUrl(
    track: Track | { audioUrl: string; audioPath?: string; storageBucket?: string; contentType?: string }
  ): Promise<string> {
    if (!track.audioUrl && !track.audioPath) return '';

    // Procedural ambient synth track
    if (track.audioUrl && track.audioUrl.startsWith('synth:')) {
      return track.audioUrl;
    }

    // 1. Check if the audio is recoverable from IndexedDB
    const lookupTarget =
      track.audioPath ||
      (track.audioUrl && !track.audioUrl.startsWith('synth:')
        ? track.audioUrl.replace(/^https?:\/\/[^/]+/, '')
        : '');

    if (lookupTarget) {
      const dbRecord = await this.getAudioFromIndexedDB(lookupTarget);
      if (dbRecord) {
        // Sync back to local dev server storage in background
        const cleanFileName = lookupTarget.replace(/^.*[\\/]/, '');
        if (dbRecord.buffer && dbRecord.buffer.byteLength > 0) {
          fetch('/api/storage/upload', {
            method: 'POST',
            headers: {
              'x-storage-bucket': 'music',
              'x-file-name': cleanFileName,
              'Content-Type': dbRecord.contentType,
            },
            body: dbRecord.buffer,
          }).catch(() => {});
        }
        return dbRecord.blobUrl;
      }
    }

    // STRICT USER MANDATE: Reject any URL starting with "blob:" that wasn't found in IndexedDB
    if (track.audioUrl && track.audioUrl.startsWith('blob:')) {
      // If audioPath exists, construct the persistent URL from storage path
      if (track.audioPath) {
        const bucket = track.storageBucket || 'music';
        if (isSupabaseConfigured()) {
          return getSupabasePublicUrl(bucket, track.audioPath);
        }
        const cleanName = track.audioPath.replace(/^music\/(audio\/)?/, '');
        return `/storage/music/${cleanName}`;
      }
      // If legacy Blob URL has no audioPath and not in IndexedDB, it cannot be salvaged
      console.warn('[StorageService] Legacy blob: URL detected without storage path:', track);
      return '';
    }

    // If audioPath exists and Supabase is configured with real credentials,
    // resolve persistent Supabase Storage public URL
    if (track.audioPath && isSupabaseConfigured()) {
      const bucket = track.storageBucket || 'music';
      return getSupabasePublicUrl(bucket, track.audioPath);
    }

    // Check if audioUrl is a real HTTP, HTTPS, or relative root URL
    if (track.audioUrl && (track.audioUrl.startsWith('http://') || track.audioUrl.startsWith('https://') || track.audioUrl.startsWith('/'))) {
      return track.audioUrl;
    }

    // If audioPath exists, generate persistent URL from storage path
    if (track.audioPath) {
      const bucket = track.storageBucket || 'music';
      if (isSupabaseConfigured()) {
        return getSupabasePublicUrl(bucket, track.audioPath);
      }
      const cleanName = track.audioPath.replace(/^music\/(audio\/)?/, '');
      return `/storage/music/${cleanName}`;
    }

    return '';
  }

  /**
   * Preflight inspection of an audio URL for development debugging
   */
  public async inspectAudioUrl(
    track: Track,
    url: string
  ): Promise<{ ok: boolean; status?: number; contentType?: string; error?: string }> {
    if (!url) {
      return { ok: false, error: 'Audio URL trống hoặc không khả dụng.' };
    }

    if (url.startsWith('synth:')) {
      return { ok: true, status: 200, contentType: 'audio/synth' };
    }

    // Valid runtime object URL from IndexedDB cache
    if (url.startsWith('blob:')) {
      return { ok: true, status: 200, contentType: track.contentType || 'audio/mpeg' };
    }

    try {
      const res = await fetch(url, { method: 'GET' });
      const cType = res.headers.get('content-type') || track.contentType || 'audio/mpeg';

      // CRITICAL FIX: Ensure response is NOT an HTML 404/fallback page
      if (!res.ok || cType.includes('text/html') || cType.includes('application/xhtml+xml')) {
        console.warn('[Audio URL Inspection Failed] Not a valid audio stream:', {
          url,
          status: res.status,
          contentType: cType,
        });
        return {
          ok: false,
          status: res.status,
          contentType: cType,
          error: `Tệp âm thanh không hợp lệ hoặc máy chủ trả về trang HTML (HTTP ${res.status}).`,
        };
      }

      const result = {
        ok: true,
        status: res.status,
        contentType: cType,
      };

      console.log('[Audio URL Inspection]', {
        trackId: track.id,
        title: track.title,
        storageBucket: track.storageBucket || 'music',
        storagePath: track.audioPath || 'N/A',
        audioUrl: url,
        contentType: cType,
        httpStatus: res.status,
        ok: res.ok,
      });

      return result;
    } catch (err: any) {
      console.warn('[Audio URL Inspection Failed]', {
        trackId: track.id,
        title: track.title,
        url,
        error: err.message,
      });
      return {
        ok: false,
        error: err.message || 'Lỗi mạng khi tải tệp âm thanh.',
      };
    }
  }
}

export const storageService = new StorageService();

