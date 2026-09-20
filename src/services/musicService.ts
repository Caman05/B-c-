import { Track } from '../types';
import { authService } from './authService';
import { getSupabase, isSupabaseConfigured, getSupabasePublicUrl } from '../lib/supabaseClient';

const STORAGE_KEY_MUSIC = 'be_ca_music_tracks_v2';
const STORAGE_KEY_ADMIN = 'be_ca_admin_role';

// Initial dynamic music tracks (Clean, peaceful ocean ambience)
const DEFAULT_TRACKS: Track[] = [
  {
    id: 'track-1',
    title: 'Biển Lặng',
    artist: 'Hải Lưu Phong',
    coverUrl: '',
    audioUrl: '/audio/wo-ai-ni.mp3',
    audioPath: undefined,
    storageBucket: 'music',
    isActive: true,
    duration: 194,
    rootFreq: 220,
    sortOrder: 1,
    createdAt: '2026-01-10T10:00:00.000Z',
    updatedAt: '2026-01-10T10:00:00.000Z',
  },
  {
    id: 'track-2',
    title: 'Đêm Sâu Dưới Nước',
    artist: 'Thủy Ngân',
    coverUrl: '',
    audioUrl: 'synth:196',
    audioPath: undefined,
    storageBucket: 'music',
    isActive: true,
    duration: 218,
    rootFreq: 196,
    sortOrder: 2,
    createdAt: '2026-01-15T12:30:00.000Z',
    updatedAt: '2026-01-15T12:30:00.000Z',
  },
  {
    id: 'track-3',
    title: 'Ánh Sáng San Hô',
    artist: 'Ngọc Trai',
    coverUrl: '',
    audioUrl: 'synth:261.63',
    audioPath: undefined,
    storageBucket: 'music',
    isActive: true,
    duration: 175,
    rootFreq: 261.63,
    sortOrder: 3,
    createdAt: '2026-01-20T14:45:00.000Z',
    updatedAt: '2026-01-20T14:45:00.000Z',
  },
  {
    id: 'track-4',
    title: 'Mặt Nước Phẳng Lặng',
    artist: '',
    coverUrl: '',
    audioUrl: 'synth:246.94',
    audioPath: undefined,
    storageBucket: 'music',
    isActive: true,
    duration: 186,
    rootFreq: 246.94,
    sortOrder: 4,
    createdAt: '2026-01-25T09:15:00.000Z',
    updatedAt: '2026-01-25T09:15:00.000Z',
  },
  {
    id: 'track-5',
    title: 'Sóng Vỗ Êm Dịu (Bản MP3)',
    artist: 'BỂ CÁ Audio',
    coverUrl: '',
    audioUrl: '/audio/test_ocean.mp3',
    audioPath: 'music/audio/test_ocean.mp3',
    storageBucket: 'music',
    contentType: 'audio/mpeg',
    isActive: true,
    duration: 120,
    sortOrder: 5,
    createdAt: '2026-02-01T08:00:00.000Z',
    updatedAt: '2026-02-01T08:00:00.000Z',
  },
];

export interface CreateTrackInput {
  title: string;
  artist?: string;
  coverUrl?: string;
  coverPath?: string;
  audioUrl: string;
  audioPath?: string;
  storageBucket?: string;
  contentType?: string;
  isActive?: boolean;
  duration?: number;
  sortOrder?: number;
}

export interface UpdateTrackInput {
  title?: string;
  artist?: string;
  coverUrl?: string;
  coverPath?: string;
  audioUrl?: string;
  audioPath?: string;
  storageBucket?: string;
  contentType?: string;
  duration?: number;
  isActive?: boolean;
  sortOrder?: number;
}

/**
 * Validates audio URL format (supports valid web audio URLs, Supabase Storage URLs, or procedural synth)
 * STRICT MANDATE: Reject temporary blob: URLs
 */
export function isValidAudioUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  // Explicitly reject blob URLs from persistent storage
  if (trimmed.startsWith('blob:')) return false;
  if (trimmed.startsWith('synth:')) return true;
  if (trimmed.startsWith('/') || trimmed.startsWith('./')) return true;
  if (trimmed.startsWith('music/') || trimmed.startsWith('audio/')) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Checks if a track is a legacy blob track that needs re-uploading
 */
export function isLegacyBlobTrack(track: Track): boolean {
  return Boolean(
    (track.audioUrl && track.audioUrl.startsWith('blob:')) ||
    track.isLegacyBlob
  );
}

class MusicService {
  /**
   * Check if current user session holds Admin privileges (backed by Supabase profiles.role)
   */
  public isAdminUser(): boolean {
    try {
      return authService.isAdmin();
    } catch {
      return false;
    }
  }

  /**
   * Set admin mode (synchronized with auth profiles)
   */
  public setAdminRole(isAdmin: boolean): void {
    try {
      if (isAdmin) {
        authService.switchUser('owner-quynhchinga1229');
      } else {
        authService.switchUser('user-demo-1');
      }
    } catch {
      // ignore
    }
  }

  /**
   * Load tracks from local cache/storage, identifying legacy blob tracks
   */
  private loadLocalTracks(): Track[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_MUSIC);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Identify any legacy blob tracks and normalize sortOrder
          const list = parsed.map((t: Track, idx: number) => {
            const item: Track = {
              ...t,
              sortOrder: typeof t.sortOrder === 'number' ? t.sortOrder : idx + 1,
            };
            if (item.audioUrl && item.audioUrl.startsWith('blob:')) {
              item.isLegacyBlob = true;
              item.isUnavailable = true;
            }
            return item;
          });
          // Sort strictly by sortOrder ascending
          list.sort((a, b) => (a.sortOrder ?? 999999) - (b.sortOrder ?? 999999));
          return list;
        }
      }
    } catch (e) {
      console.warn('Failed to parse music tracks from storage:', e);
    }
    // Initialize defaults if empty
    this.saveLocalTracks(DEFAULT_TRACKS, false);
    return DEFAULT_TRACKS;
  }

  /**
   * Save tracks to persistent store and notify listeners
   */
  private saveLocalTracks(tracks: Track[], dispatchEvent = true): void {
    try {
      // Keep tracks ordered by sortOrder
      const sorted = [...tracks].sort((a, b) => (a.sortOrder ?? 999999) - (b.sortOrder ?? 999999));
      localStorage.setItem(STORAGE_KEY_MUSIC, JSON.stringify(sorted));
      if (dispatchEvent) {
        window.dispatchEvent(new CustomEvent('be_ca_music_updated'));
      }
    } catch (e) {
      console.error('Failed to save music tracks to localStorage:', e);
    }
  }

  /**
   * USER OPERATION:
   * Normal users can only SELECT active tracks and playable tracks (no broken legacy blob tracks)
   * Strictly ordered by sort_order ASC
   */
  public async getActiveTracks(): Promise<Track[]> {
    const client = getSupabase();
    if (client) {
      try {
        let res = await client
          .from('music_tracks')
          .select('*')
          .eq('is_active', true)
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: false });

        if (res.error && res.error.message?.includes('sort_order')) {
          res = await client
            .from('music_tracks')
            .select('*')
            .eq('is_active', true)
            .order('created_at', { ascending: false });
        }

        const { data, error } = res;

        if (!error && data && data.length > 0) {
          const mapped: Track[] = data.map((row: any, idx: number) => ({
            id: row.id,
            title: row.title,
            artist: row.artist || '',
            coverUrl: row.cover_url || '',
            audioUrl: row.audio_url,
            audioPath: row.audio_path || undefined,
            storageBucket: row.storage_bucket || 'music',
            contentType: row.content_type || undefined,
            duration: row.duration || 180,
            isActive: Boolean(row.is_active),
            sortOrder: typeof row.sort_order === 'number' ? row.sort_order : idx + 1,
            isLegacyBlob: Boolean(row.audio_url && row.audio_url.startsWith('blob:')),
            isUnavailable: Boolean(row.audio_url && row.audio_url.startsWith('blob:')),
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          }));

          // Ensure strict ordering by sort_order ASC
          mapped.sort((a, b) => {
            const orderA = a.sortOrder ?? 999999;
            const orderB = b.sortOrder ?? 999999;
            if (orderA !== orderB) return orderA - orderB;
            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          });

          // Filter out legacy blob tracks for normal playback
          const playable = mapped.filter((t) => !t.isLegacyBlob && !t.audioUrl.startsWith('blob:'));
          this.saveLocalTracks(mapped, false);
          return playable.length > 0 ? playable : mapped;
        }
      } catch (err) {
        console.warn('[musicService] Supabase getActiveTracks failed, using local store:', err);
      }
    }

    // Fallback to local tracks
    const tracks = this.loadLocalTracks();
    const active = tracks.filter((t) => t.isActive && !t.isLegacyBlob && !t.audioUrl.startsWith('blob:'));
    return active.sort((a, b) => (a.sortOrder ?? 999999) - (b.sortOrder ?? 999999));
  }

  /**
   * ADMIN OPERATION:
   * View all tracks (both active, inactive, and legacy blob tracks for management)
   * Strictly ordered by sort_order ASC
   */
  public async getAllTracks(): Promise<Track[]> {
    const client = getSupabase();
    if (client) {
      try {
        let res = await client
          .from('music_tracks')
          .select('*')
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: false });

        if (res.error && res.error.message?.includes('sort_order')) {
          res = await client
            .from('music_tracks')
            .select('*')
            .order('created_at', { ascending: false });
        }

        const { data, error } = res;

        if (!error && data && data.length > 0) {
          const mapped: Track[] = data.map((row: any, idx: number) => ({
            id: row.id,
            title: row.title,
            artist: row.artist || '',
            coverUrl: row.cover_url || '',
            audioUrl: row.audio_url,
            audioPath: row.audio_path || undefined,
            storageBucket: row.storage_bucket || 'music',
            contentType: row.content_type || undefined,
            duration: row.duration || 180,
            isActive: Boolean(row.is_active),
            sortOrder: typeof row.sort_order === 'number' ? row.sort_order : idx + 1,
            isLegacyBlob: Boolean(row.audio_url && row.audio_url.startsWith('blob:')),
            isUnavailable: Boolean(row.audio_url && row.audio_url.startsWith('blob:')),
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          }));

          // Strict ordering by sort_order ASC
          mapped.sort((a, b) => {
            const orderA = a.sortOrder ?? 999999;
            const orderB = b.sortOrder ?? 999999;
            if (orderA !== orderB) return orderA - orderB;
            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          });

          this.saveLocalTracks(mapped, false);
          return mapped;
        }
      } catch (err) {
        console.warn('[musicService] Supabase getAllTracks failed, using local store:', err);
      }
    }

    return this.loadLocalTracks();
  }

  /**
   * ADMIN ONLY:
   * Insert new music track with strict validation and access control
   */
  public async createTrack(input: CreateTrackInput): Promise<Track> {
    if (!this.isAdminUser()) {
      throw new Error('Từ chối quyền truy cập: Chỉ Quản trị viên (Admin) mới có quyền thêm bài hát theo chính sách bảo mật RLS.');
    }

    const title = input.title?.trim();
    if (!title) {
      throw new Error('Tên bài hát là bắt buộc và không được để trống.');
    }

    let audioUrl = input.audioUrl?.trim() || '';
    const audioPath = input.audioPath?.trim();
    const storageBucket = input.storageBucket?.trim() || 'music';

    // If audioUrl is empty or not given, but audioPath is available, derive persistent audioUrl
    if (!audioUrl && audioPath) {
      if (isSupabaseConfigured()) {
        audioUrl = getSupabasePublicUrl(storageBucket, audioPath);
      } else {
        const cleanName = audioPath.replace(/^music\/(audio\/)?/, '');
        audioUrl = `/storage/music/${cleanName}`;
      }
    }

    if (!audioUrl) {
      throw new Error('Audio URL hoặc Storage Path là bắt buộc và phải là tệp hợp lệ.');
    }

    // STRICT MANDATE: Refuse blob: URLs completely
    if (audioUrl.startsWith('blob:')) {
      if (audioPath) {
        audioUrl = isSupabaseConfigured()
          ? getSupabasePublicUrl(storageBucket, audioPath)
          : `/storage/music/${audioPath.replace(/^music\/(audio\/)?/, '')}`;
      } else {
        throw new Error(
          'Lỗi bảo mật: Không được phép lưu Blob URL tạm thời ("blob:..."). Hãy tải file audio lên Supabase Storage bucket "music" để nhận URL/path persistent.'
        );
      }
    }

    if (!isValidAudioUrl(audioUrl)) {
      throw new Error('Audio URL không hợp lệ. Vui lòng cung cấp link trực tiếp (http/https/Supabase Storage) hoặc synth:freq.');
    }

    let coverUrl = input.coverUrl?.trim() || '';
    const coverPath = input.coverPath?.trim();

    // STRICT MANDATE: Reject blob: URLs for cover images
    if (coverUrl.startsWith('blob:')) {
      throw new Error(
        'Lỗi bảo mật: Không được phép lưu Blob URL tạm thời ("blob:...") cho ảnh bìa. Hãy tải file ảnh bìa lên Storage để nhận URL persistent.'
      );
    }
    if (coverUrl.toLowerCase().startsWith('file:') || coverUrl.toLowerCase().includes('fakepath')) {
      throw new Error('Đường dẫn tệp local trên máy không hợp lệ cho ảnh bìa.');
    }

    const existingTracks = this.loadLocalTracks();
    const maxSort = existingTracks.reduce((max, t) => Math.max(max, t.sortOrder ?? 0), 0);
    const assignedSortOrder = input.sortOrder !== undefined ? input.sortOrder : maxSort + 1;

    const newTrack: Track = {
      id: `track-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      title,
      artist: input.artist?.trim() || '',
      coverUrl: coverUrl || '',
      coverPath: coverPath || undefined,
      audioUrl,
      audioPath: audioPath || undefined,
      storageBucket,
      contentType: input.contentType?.trim() || undefined,
      isActive: input.isActive !== undefined ? input.isActive : true,
      duration: input.duration && input.duration > 0 ? input.duration : 180,
      rootFreq: 220,
      sortOrder: assignedSortOrder,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 1. Sync to Supabase `music_tracks` table if configured
    const client = getSupabase();
    if (client) {
      try {
        const { data, error } = await client.from('music_tracks').insert({
          title: newTrack.title,
          artist: newTrack.artist || null,
          cover_url: newTrack.coverUrl || null,
          audio_url: newTrack.audioUrl,
          audio_path: newTrack.audioPath || null,
          storage_bucket: newTrack.storageBucket || 'music',
          content_type: newTrack.contentType || null,
          duration: newTrack.duration,
          is_active: newTrack.isActive,
          sort_order: newTrack.sortOrder,
        }).select().single();

        if (error) {
          console.warn('[Supabase music_tracks Insert Warning]:', error.message);
        } else if (data?.id) {
          newTrack.id = data.id;
        }
      } catch (err) {
        console.warn('[Supabase music_tracks Insert Network Error]:', err);
      }
    }

    // 2. Save to local storage: place new track at the end of playlist default
    const updated = [...existingTracks, newTrack];
    this.saveLocalTracks(updated);
    return newTrack;
  }

  /**
   * ADMIN ONLY:
   * Update existing music track
   */
  public async updateTrack(id: string, input: UpdateTrackInput): Promise<Track> {
    if (!this.isAdminUser()) {
      throw new Error('Từ chối quyền truy cập: Chỉ Quản trị viên (Admin) mới có quyền chỉnh sửa bài hát theo chính sách bảo mật RLS.');
    }

    const tracks = this.loadLocalTracks();
    const index = tracks.findIndex((t) => t.id === id);
    if (index === -1) {
      throw new Error(`Không tìm thấy bài hát với id: ${id}`);
    }

    const current = tracks[index];
    let newAudioUrl = input.audioUrl !== undefined ? input.audioUrl.trim() : current.audioUrl;
    const newAudioPath = input.audioPath !== undefined ? input.audioPath.trim() : (current.audioPath || '');
    const storageBucket = input.storageBucket !== undefined ? input.storageBucket.trim() : (current.storageBucket || 'music');

    // If audioUrl is empty but audioPath exists, resolve persistent URL
    if (!newAudioUrl && newAudioPath) {
      if (isSupabaseConfigured()) {
        newAudioUrl = getSupabasePublicUrl(storageBucket, newAudioPath);
      } else {
        const cleanName = newAudioPath.replace(/^music\/(audio\/)?/, '');
        newAudioUrl = `/storage/music/${cleanName}`;
      }
    }

    // Auto-heal legacy blob URLs if audioPath is present
    if (newAudioUrl && newAudioUrl.startsWith('blob:') && newAudioPath) {
      newAudioUrl = isSupabaseConfigured()
        ? getSupabasePublicUrl(storageBucket, newAudioPath)
        : `/storage/music/${newAudioPath.replace(/^music\/(audio\/)?/, '')}`;
    }

    // STRICT MANDATE: Refuse unresolved blob: URLs
    if (newAudioUrl && newAudioUrl.startsWith('blob:')) {
      throw new Error(
        'Lỗi bảo mật: Không được phép cập nhật bằng Blob URL tạm thời ("blob:..."). Hãy tải file audio lên Supabase Storage bucket "music".'
      );
    }

    let newCoverUrl = input.coverUrl !== undefined ? input.coverUrl.trim() : current.coverUrl;
    const newCoverPath = input.coverPath !== undefined ? input.coverPath.trim() : (current.coverPath || '');

    // Refuse blob: URLs for cover images
    if (newCoverUrl && newCoverUrl.startsWith('blob:')) {
      throw new Error(
        'Lỗi bảo mật: Không được phép lưu Blob URL tạm thời ("blob:...") cho ảnh bìa. Hãy tải file ảnh bìa lên Storage để nhận URL persistent.'
      );
    }
    if (newCoverUrl && (newCoverUrl.toLowerCase().startsWith('file:') || newCoverUrl.toLowerCase().includes('fakepath'))) {
      throw new Error('Đường dẫn tệp local trên máy không hợp lệ cho ảnh bìa.');
    }

    const updatedTrack: Track = {
      ...current,
      title: input.title !== undefined ? input.title.trim() : current.title,
      artist: input.artist !== undefined ? input.artist.trim() : current.artist,
      coverUrl: newCoverUrl || '',
      coverPath: newCoverPath || undefined,
      audioUrl: newAudioUrl,
      audioPath: newAudioPath || undefined,
      storageBucket,
      contentType: input.contentType !== undefined ? input.contentType.trim() : current.contentType,
      duration: input.duration !== undefined && input.duration > 0 ? input.duration : current.duration,
      isActive: input.isActive !== undefined ? input.isActive : current.isActive,
      sortOrder: input.sortOrder !== undefined ? input.sortOrder : current.sortOrder,
      isLegacyBlob: Boolean(newAudioUrl && newAudioUrl.startsWith('blob:')),
      isUnavailable: Boolean(newAudioUrl && newAudioUrl.startsWith('blob:')),
      updatedAt: new Date().toISOString(),
    };

    if (!updatedTrack.title) {
      throw new Error('Tên bài hát không được để trống.');
    }

    // 1. Sync to Supabase `music_tracks` table if configured
    const client = getSupabase();
    if (client) {
      try {
        const { error } = await client
          .from('music_tracks')
          .update({
            title: updatedTrack.title,
            artist: updatedTrack.artist || null,
            cover_url: updatedTrack.coverUrl || null,
            audio_url: updatedTrack.audioUrl,
            audio_path: updatedTrack.audioPath || null,
            storage_bucket: updatedTrack.storageBucket || 'music',
            content_type: updatedTrack.contentType || null,
            duration: updatedTrack.duration,
            is_active: updatedTrack.isActive,
            sort_order: updatedTrack.sortOrder,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);

        if (error) {
          console.warn('[Supabase music_tracks Update Warning]:', error.message);
        }
      } catch (err) {
        console.warn('[Supabase music_tracks Update Network Error]:', err);
      }
    }

    // 2. Save locally
    tracks[index] = updatedTrack;
    this.saveLocalTracks(tracks);
    return updatedTrack;
  }

  /**
   * ADMIN ONLY:
   * Reorder tracks and persist new sort_order to Supabase and local cache
   */
  public async reorderTracks(orderedIds: string[]): Promise<Track[]> {
    if (!this.isAdminUser()) {
      throw new Error('Từ chối quyền truy cập: Chỉ Quản trị viên (Admin) mới có quyền sắp xếp thứ tự bài hát.');
    }

    const currentTracks = this.loadLocalTracks();
    const trackMap = new Map(currentTracks.map((t) => [t.id, t]));

    const reordered: Track[] = [];
    orderedIds.forEach((id, idx) => {
      const track = trackMap.get(id);
      if (track) {
        reordered.push({
          ...track,
          sortOrder: idx + 1,
          updatedAt: new Date().toISOString(),
        });
        trackMap.delete(id);
      }
    });

    // Append any leftover tracks that weren't in orderedIds
    trackMap.forEach((track) => {
      reordered.push({
        ...track,
        sortOrder: reordered.length + 1,
        updatedAt: new Date().toISOString(),
      });
    });

    // 1. Sync new sort_order to Supabase music_tracks table
    const client = getSupabase();
    if (client) {
      try {
        const updatePromises = reordered.map((t) =>
          client
            .from('music_tracks')
            .update({
              sort_order: t.sortOrder,
              updated_at: new Date().toISOString(),
            })
            .eq('id', t.id)
        );
        await Promise.allSettled(updatePromises);
      } catch (err) {
        console.warn('[Supabase music_tracks reorder Warning]:', err);
      }
    }

    // 2. Save locally and dispatch update event so MusicPlayer & Admin immediately reflect order
    this.saveLocalTracks(reordered, true);
    return reordered;
  }

  /**
   * ADMIN ONLY:
   * Toggle track active status
   */
  public async toggleTrackActive(id: string, isActive: boolean): Promise<Track> {
    if (!this.isAdminUser()) {
      throw new Error('Từ chối quyền truy cập: Chỉ Quản trị viên (Admin) mới có quyền bật/tắt bài hát theo chính sách bảo mật RLS.');
    }

    return this.updateTrack(id, { isActive });
  }

  /**
   * ADMIN ONLY:
   * Delete music track and normalize sort_order
   */
  public async deleteTrack(id: string): Promise<boolean> {
    if (!this.isAdminUser()) {
      throw new Error('Từ chối quyền truy cập: Chỉ Quản trị viên (Admin) mới có quyền xóa bài hát theo chính sách bảo mật RLS.');
    }

    const tracks = this.loadLocalTracks();
    const remaining = tracks.filter((t) => t.id !== id);
    if (remaining.length === tracks.length) {
      return false;
    }

    // Normalize remaining tracks to 1..N
    const normalized = remaining.map((t, idx) => ({
      ...t,
      sortOrder: idx + 1,
    }));

    // 1. Sync delete & reorder to Supabase if configured
    const client = getSupabase();
    if (client) {
      try {
        const { error } = await client.from('music_tracks').delete().eq('id', id);
        if (error) {
          console.warn('[Supabase music_tracks Delete Warning]:', error.message);
        }
        // Normalize remaining tracks in Supabase
        const updates = normalized.map((t) =>
          client
            .from('music_tracks')
            .update({ sort_order: t.sortOrder, updated_at: new Date().toISOString() })
            .eq('id', t.id)
        );
        await Promise.allSettled(updates);
      } catch (err) {
        console.warn('[Supabase music_tracks Delete Network Error]:', err);
      }
    }

    // 2. Save normalized locally
    this.saveLocalTracks(normalized);
    return true;
  }

  /**
   * SHUFFLE / RANDOM UTILITIES:
   * Shuffles an array of tracks using Fisher-Yates algorithm.
   * Returns a new array copy without mutating the original.
   */
  public shuffleTracks(tracks: Track[]): Track[] {
    if (!tracks || tracks.length <= 1) return [...(tracks || [])];
    const shuffled = [...tracks];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Computes the next track index randomly.
   * GUARANTEE: The returned index is strictly different from currentIndex (no immediate duplicate playback).
   * Also avoids recently played indices if possible to ensure variety across the whole playlist.
   */
  public getRandomNextTrackIndex(
    currentIndex: number,
    total: number,
    recentlyPlayedIndices: number[] = []
  ): number {
    if (total <= 1) return 0;

    // 1. Pick from indices that are neither current nor in recent history
    const unplayedCandidates: number[] = [];
    for (let i = 0; i < total; i++) {
      if (i !== currentIndex && !recentlyPlayedIndices.includes(i)) {
        unplayedCandidates.push(i);
      }
    }

    if (unplayedCandidates.length > 0) {
      const randomIndex = Math.floor(Math.random() * unplayedCandidates.length);
      return unplayedCandidates[randomIndex];
    }

    // 2. If all other tracks have been played, allow any track EXCEPT currentIndex
    const fallbackCandidates: number[] = [];
    for (let i = 0; i < total; i++) {
      if (i !== currentIndex) {
        fallbackCandidates.push(i);
      }
    }

    const randomIndex = Math.floor(Math.random() * fallbackCandidates.length);
    return fallbackCandidates[randomIndex];
  }

  /**
   * Picks a random track from a collection, avoiding excludeId if possible.
   */
  public getRandomTrack(tracks: Track[], excludeId?: string): Track | null {
    if (!tracks || tracks.length === 0) return null;
    if (tracks.length === 1) return tracks[0];
    const candidates = tracks.filter((t) => t.id !== excludeId);
    if (candidates.length === 0) return tracks[0];
    const randomIndex = Math.floor(Math.random() * candidates.length);
    return candidates[randomIndex];
  }
}

export const musicService = new MusicService();
