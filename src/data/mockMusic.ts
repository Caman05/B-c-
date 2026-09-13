import { Track } from '../types';

export const PLAYLIST: Track[] = [
  {
    id: 'track-1',
    title: 'Wo Ai Ni',
    artist: 'Trash Dee',
    audioUrl: '/audio/wo-ai-ni.mp3.mp3',
    isActive: true,
    duration: 118,
    rootFreq: 220,
    createdAt: '2026-01-10T10:00:00.000Z',
    updatedAt: '2026-01-10T10:00:00.000Z',
  },
  {
    id: 'track-2',
    title: 'Đêm Sâu Dưới Nước',
    artist: 'Thủy Ngân',
    audioUrl: 'synth:196',
    isActive: true,
    duration: 218,
    rootFreq: 196,
    createdAt: '2026-01-15T12:30:00.000Z',
    updatedAt: '2026-01-15T12:30:00.000Z',
  },
  {
    id: 'track-3',
    title: 'Ánh Sáng San Hô',
    artist: 'Ngọc Trai',
    audioUrl: 'synth:261.63',
    isActive: true,
    duration: 175,
    rootFreq: 261.63,
    createdAt: '2026-01-20T14:45:00.000Z',
    updatedAt: '2026-01-20T14:45:00.000Z',
  },
  {
    id: 'track-4',
    title: 'Mặt Nước Phẳng Lặng',
    artist: '',
    audioUrl: 'synth:246.94',
    isActive: true,
    duration: 186,
    rootFreq: 246.94,
    createdAt: '2026-01-25T09:15:00.000Z',
    updatedAt: '2026-01-25T09:15:00.000Z',
  }
];
