/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Character, PageView } from './types';
import { characterService } from './services/characterService';
import { characterRepository } from './services/characterRepository';
import { storageService } from './services/storageService';
import { authService } from './services/authService';
import { AquariumBackground } from './components/AquariumBackground';
import { EntryScreen } from './components/EntryScreen';
import { Navigation } from './components/Navigation';
import { MusicPlayer } from './components/MusicPlayer';
import { CharacterDetailModal } from './components/CharacterDetailModal';

// Pages
import { Home } from './pages/Home';
import { CharacterLibrary } from './pages/CharacterLibrary';
import { Favorites } from './pages/Favorites';
import { Profile } from './pages/Profile';
import { AdminDashboard } from './pages/admin/AdminDashboard';

export default function App() {
  const [hasEntered, setHasEntered] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<PageView>('home');
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState<boolean>(false);
  const [isTestMemberMode, setIsTestMemberMode] = useState<boolean>(() => authService.isTestMemberMode());

  useEffect(() => {
    const handleTestMode = () => {
      setIsTestMemberMode(authService.isTestMemberMode());
    };
    window.addEventListener('be_ca_test_mode_changed', handleTestMode);
    window.addEventListener('be_ca_auth_role_changed', handleTestMode);
    return () => {
      window.removeEventListener('be_ca_test_mode_changed', handleTestMode);
      window.removeEventListener('be_ca_auth_role_changed', handleTestMode);
    };
  }, []);

  // Detect /admin or #admin route
  const checkIsAdminRoute = () => {
    return window.location.pathname.startsWith('/admin') || window.location.hash.startsWith('#admin');
  };

  const [isAdminRoute, setIsAdminRoute] = useState<boolean>(checkIsAdminRoute);

  useEffect(() => {
    const handleUrlChange = () => {
      setIsAdminRoute(checkIsAdminRoute());
    };
    window.addEventListener('popstate', handleUrlChange);
    window.addEventListener('hashchange', handleUrlChange);
    return () => {
      window.removeEventListener('popstate', handleUrlChange);
      window.removeEventListener('hashchange', handleUrlChange);
    };
  }, []);

  const handleNavigateToAdmin = (initialView?: string) => {
    setIsAdminRoute(true);
    const targetUrl = initialView ? `/admin?view=${encodeURIComponent(initialView)}` : '/admin';
    try {
      window.history.pushState(null, '', targetUrl);
    } catch {
      window.location.hash = initialView ? `#admin-${initialView}` : '#admin';
    }
  };

  const handleExitAdmin = () => {
    setIsAdminRoute(false);
    try {
      window.history.pushState(null, '', '/');
    } catch {
      window.location.hash = '';
    }
  };

  // Load initial characters synchronously via characterService abstraction
  const [characters, setCharacters] = useState<Character[]>(() => {
    return characterService.getCharactersSync();
  });

  // Listen to multi-user switch or unlock events to keep catalog reactive
  useEffect(() => {
    const handleReload = () => {
      setCharacters(characterService.getCharactersSync());
    };
    window.addEventListener('be_ca_user_switched', handleReload);
    window.addEventListener('be_ca_character_unlocked', handleReload);
    window.addEventListener('be_ca_user_character_changed', handleReload);
    window.addEventListener('be_ca_catalog_updated', handleReload);
    return () => {
      window.removeEventListener('be_ca_user_switched', handleReload);
      window.removeEventListener('be_ca_character_unlocked', handleReload);
      window.removeEventListener('be_ca_user_character_changed', handleReload);
      window.removeEventListener('be_ca_catalog_updated', handleReload);
    };
  }, []);

  // Startup: Preload images from local IndexedDB storage and fetch fresh characters
  useEffect(() => {
    let isMounted = true;
    const initAppCharacters = async () => {
      try {
        await storageService.preloadCharacterImages();
        const fresh = await characterRepository.getAllCharacters();
        if (isMounted && Array.isArray(fresh) && fresh.length > 0) {
          setCharacters(characterService.getCharactersSync());
        }
      } catch (err) {
        console.warn('[App] Character sync startup warning:', err);
      }
    };
    initAppCharacters();
    return () => {
      isMounted = false;
    };
  }, []);

  // Keep selectedCharacter in sync with characters array if updated
  useEffect(() => {
    if (selectedCharacter) {
      const updated = characters.find((c) => c.id === selectedCharacter.id);
      if (updated) {
        setSelectedCharacter(updated);
      }
    }
  }, [characters]);

  // Handler: Enter the aquarium
  const handleEnter = (enableAudio: boolean) => {
    setHasEntered(true);
    if (enableAudio) {
      setIsAudioPlaying(true);
    }
  };

  // Handler: Toggle Favorite via Service Layer
  const handleToggleFavorite = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const updated = await characterService.toggleFavorite(id);
      setCharacters((prev) => prev.map((c) => (c.id === id ? updated : c)));
    } catch (err) {
      console.error('Error toggling favorite:', err);
    }
  };

  // Handler: Toggle Pet via Service Layer (Set as pet / Remove as pet)
  const handleTogglePet = async (id: string) => {
    try {
      const updated = await characterService.togglePet(id);
      setCharacters((prev) => prev.map((c) => (c.id === id ? updated : c)));
    } catch (err) {
      console.error('Error toggling pet:', err);
    }
  };

  // Handler: Unlock Character via Service Layer
  const handleUnlockCharacter = async (id: string, code?: string) => {
    try {
      const res = await characterService.unlockCharacter(id, code);
      const updatedList = characterService.getCharactersSync();
      setCharacters(updatedList);
      if (selectedCharacter && selectedCharacter.id === id) {
        setSelectedCharacter(res.character);
      }
      return res.result;
    } catch (err: any) {
      return {
        success: false,
        message: err?.message || 'Không thể mở khóa nhân vật.',
      };
    }
  };

  // Handler: Character Deleted (Admin operation)
  const handleCharacterDeleted = (id: string) => {
    setSelectedCharacter(null);
    setCharacters((prev) => prev.filter((c) => c.id !== id));
  };

  // Dynamic real data stats calculation
  const totalCount = characters.length;
  const unlockedCount = characters.filter((c) => !Boolean(c.isLocked ?? c.locked)).length;
  const favoritesCount = characters.filter((c) => Boolean(c.isPet ?? c.pet)).length;
  const lockedCount = characters.filter((c) => Boolean(c.isLocked ?? c.locked)).length;

  // Render Admin Dashboard if currently on /admin or #admin route
  if (isAdminRoute) {
    return <AdminDashboard onExitAdmin={handleExitAdmin} />;
  }

  return (
    <div className="relative min-h-screen text-[#0a2540] selection:bg-cyan-200 selection:text-cyan-900">
      {/* 1. Global Layered Aquarium Background */}
      <AquariumBackground />

      {/* 2. Entrance Screen or Main Application */}
      {!hasEntered ? (
        <EntryScreen onEnter={handleEnter} />
      ) : (
        <div className="relative z-10 min-h-screen flex flex-col">
          {/* Global Test as Member Mode Notification Banner */}
          {isTestMemberMode && (
            <div 
              id="global-test-member-mode-banner"
              className="sticky top-0 z-50 bg-amber-500 text-slate-950 px-4 py-2 text-xs font-medium shadow-md flex items-center justify-between flex-wrap gap-2 animate-fadeIn"
            >
              <div className="flex items-center gap-2">
                <span className="text-base">🧪</span>
                <span>
                  <strong>Chế độ Xem thử Thành viên (Member View):</strong> Bạn đang trải nghiệm giao diện người dùng thường. Toàn bộ tính năng Admin tạm thời bị ẩn.
                </span>
              </div>
              <button
                type="button"
                onClick={() => authService.restoreOwnerAdmin()}
                className="px-3 py-1 rounded-lg bg-slate-950 text-amber-300 hover:text-white font-bold text-xs shadow-xs transition-colors cursor-pointer whitespace-nowrap"
              >
                Khôi phục quyền Chủ App (Admin)
              </button>
            </div>
          )}

          {/* Responsive Navigation (Sidebar for desktop, Header + Bottom bar for mobile) */}
          <Navigation
            currentPage={currentPage}
            onPageChange={(page) => {
              setCurrentPage(page);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onNavigateToAdmin={handleNavigateToAdmin}
            unlockedCount={unlockedCount}
            totalCount={totalCount}
            favoritesCount={favoritesCount}
            lockedCount={lockedCount}
            isAudioPlaying={isAudioPlaying}
            onToggleAudio={() => setIsAudioPlaying(!isAudioPlaying)}
          />

          {/* Main Content Area */}
          <main 
            id="main-content-region"
            className="flex-1 lg:pl-64 pt-16 lg:pt-8 px-4 sm:px-6 lg:px-10 max-w-7xl w-full mx-auto pb-24 lg:pb-16"
          >
            {currentPage === 'home' && (
              <Home
                characters={characters}
                onNavigate={(page) => {
                  setCurrentPage(page);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              />
            )}

            {currentPage === 'library' && (
              <CharacterLibrary
                characters={characters}
                onSelectCharacter={setSelectedCharacter}
                onToggleFavorite={handleToggleFavorite}
              />
            )}

            {currentPage === 'favorites' && (
              <Favorites
                characters={characters}
                onSelectCharacter={setSelectedCharacter}
                onToggleFavorite={handleToggleFavorite}
                onNavigate={setCurrentPage}
              />
            )}

            {currentPage === 'profile' && (
              <Profile
                characters={characters}
                onNavigate={setCurrentPage}
                onNavigateToAdmin={handleNavigateToAdmin}
                onLogout={() => setHasEntered(false)}
              />
            )}
          </main>

          {/* Floating Underwater Music Player */}
          <MusicPlayer
            isPlaying={isAudioPlaying}
            onTogglePlay={() => setIsAudioPlaying(!isAudioPlaying)}
          />

          {/* Character Detail View / Modal */}
          {selectedCharacter && (
            <CharacterDetailModal
              character={selectedCharacter}
              allCharacters={characters}
              onClose={() => setSelectedCharacter(null)}
              onToggleFavorite={handleToggleFavorite}
              onTogglePet={handleTogglePet}
              onUnlockCharacter={handleUnlockCharacter}
              onSelectCharacter={setSelectedCharacter}
              onCharacterDeleted={handleCharacterDeleted}
            />
          )}
        </div>
      )}
    </div>
  );
}
