import React, { useState } from 'react';
import { AdminView } from '../../types';
import { AdminAccessGuard } from '../../components/admin/AdminAccessGuard';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { AdminOverview } from '../../components/admin/AdminOverview';
import { AdminCharacters } from '../../components/admin/AdminCharacters';
import { AdminTags } from '../../components/admin/AdminTags';
import { AdminMusic } from '../../components/admin/AdminMusic';
import { AdminUnlocks } from '../../components/admin/AdminUnlocks';
import { AdminUsers } from '../../components/admin/AdminUsers';

interface AdminDashboardProps {
  onExitAdmin: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onExitAdmin }) => {
  const [currentView, setCurrentView] = useState<AdminView>('overview');

  // Trigger states for quick action modals
  const [requestAddCharacter, setRequestAddCharacter] = useState(false);
  const [requestAddMusic, setRequestAddMusic] = useState(false);
  const [requestAddTag, setRequestAddTag] = useState(false);
  const [targetCharacterForUnlock, setTargetCharacterForUnlock] = useState<string | null>(null);

  const handleOpenUnlockForCharacter = (characterId: string) => {
    setTargetCharacterForUnlock(characterId);
    setCurrentView('unlocks');
  };

  return (
    <AdminAccessGuard onExitAdmin={onExitAdmin}>
      <AdminLayout
        currentView={currentView}
        onViewChange={(view) => {
          setCurrentView(view);
        }}
        onExitAdmin={onExitAdmin}
      >
        {currentView === 'overview' && (
          <AdminOverview
            onNavigate={(view) => setCurrentView(view)}
            onOpenAddCharacter={() => {
              setCurrentView('characters');
              setRequestAddCharacter(true);
            }}
            onOpenAddMusic={() => {
              setCurrentView('music');
              setRequestAddMusic(true);
            }}
            onOpenAddTag={() => {
              setCurrentView('tags');
              setRequestAddTag(true);
            }}
          />
        )}

        {currentView === 'characters' && (
          <AdminCharacters
            onOpenUnlockConfig={handleOpenUnlockForCharacter}
            onRequestAdd={requestAddCharacter}
            onResetRequestAdd={() => setRequestAddCharacter(false)}
          />
        )}

        {currentView === 'tags' && (
          <AdminTags
            onRequestAdd={requestAddTag}
            onResetRequestAdd={() => setRequestAddTag(false)}
          />
        )}

        {currentView === 'unlocks' && (
          <AdminUnlocks initialCharacterId={targetCharacterForUnlock} />
        )}

        {currentView === 'music' && (
          <AdminMusic
            onRequestAdd={requestAddMusic}
            onResetRequestAdd={() => setRequestAddMusic(false)}
          />
        )}

        {currentView === 'users' && <AdminUsers />}
      </AdminLayout>
    </AdminAccessGuard>
  );
};
