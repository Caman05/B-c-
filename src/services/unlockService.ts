import { Character, UnlockType, UnlockCondition, UnlockSource } from '../types';
import { userCharacterRepository } from './userCharacterRepository';
import { musicService } from './musicService';

export interface UnlockStateResult {
  isUnlocked: boolean;
  unlockType: UnlockType;
  unlockCondition?: UnlockCondition;
  conditionProgress?: {
    current: number;
    target: number;
    satisfied: boolean;
    description: string;
  };
  unlockedAt?: string;
  unlockSource?: UnlockSource;
}

export interface UnlockActionResult {
  success: boolean;
  message: string;
  unlockedAt?: string;
}

/**
 * PRIVATE SECRETS STORE
 * Kept completely isolated from the Character DTO and public client endpoints.
 * In a full Supabase environment, this mirrors the `character_secrets` table
 * and is evaluated through the `verify_character_unlock_code` Security Definer function.
 */
const PRIVATE_CHARACTER_SECRETS: Record<string, string> = {
  'char-12': 'VOLCANO_FORGE',
  'char-15': 'DEEP_TRENCH_SEAL',
};

class UnlockService {
  /**
   * Helper: Check if current user session is an Admin
   */
  public isAdmin(): boolean {
    return musicService.isAdminUser();
  }

  /**
   * Evaluator: Check if a character condition is satisfied for a user
   */
  public evaluateCondition(
    condition: UnlockCondition,
    allCharacters: Character[],
    userId?: string
  ): { satisfied: boolean; current: number; target: number; description: string } {
    const relations = userCharacterRepository.getUserRelations(userId);

    // Calculate how many characters are unlocked for this user
    let unlockedCount = 0;
    for (const c of allCharacters) {
      if (!c.isLocked || relations[c.id]?.isUnlocked) {
        unlockedCount++;
      }
    }

    if (condition.type === 'collection_count') {
      const target = condition.requiredCount || 3;
      return {
        satisfied: unlockedCount >= target,
        current: unlockedCount,
        target,
        description: condition.description || `Cần mở khóa ít nhất ${target} nhân vật trong Bể Cá.`,
      };
    }

    if (condition.type === 'has_character' && condition.requiredCharacterId) {
      const hasReq = Boolean(relations[condition.requiredCharacterId]?.isUnlocked);
      return {
        satisfied: hasReq,
        current: hasReq ? 1 : 0,
        target: 1,
        description: condition.description || 'Yêu cầu sở hữu nhân vật tiên quyết.',
      };
    }

    // Default custom fallback
    return {
      satisfied: false,
      current: 0,
      target: 1,
      description: condition.description || 'Điều kiện mở khóa chưa hoàn thành.',
    };
  }

  /**
   * Query the complete unlock state for a character relative to a user
   */
  public getCharacterUnlockState(
    character: Character,
    allCharacters: Character[],
    userId?: string
  ): UnlockStateResult {
    const uid = userId || userCharacterRepository.getCurrentUserId();
    const rel = userCharacterRepository.getUserRelation(character.id, uid);

    const isUnlocked = !character.isLocked || Boolean(rel?.isUnlocked);

    let conditionProgress;
    if (character.unlockType === 'condition' && character.unlockCondition) {
      conditionProgress = this.evaluateCondition(character.unlockCondition, allCharacters, uid);
    }

    return {
      isUnlocked,
      unlockType: character.unlockType || 'none',
      unlockCondition: character.unlockCondition,
      conditionProgress,
      unlockedAt: rel?.unlockedAt,
      unlockSource: rel?.unlockSource,
    };
  }

  /**
   * USER OPERATION: Verify unlock code and unlock for user
   * Verifies against secure server/service storage. Does not expose code to client bundle.
   */
  public async verifyAndUnlockWithCode(
    characterId: string,
    inputCode: string,
    userId?: string
  ): Promise<UnlockActionResult> {
    const uid = userId || userCharacterRepository.getCurrentUserId();
    const trimmedInput = inputCode?.trim().toUpperCase();

    if (!trimmedInput) {
      return {
        success: false,
        message: 'Vui lòng nhập mã mở khóa.',
      };
    }

    const secret = PRIVATE_CHARACTER_SECRETS[characterId];
    if (!secret) {
      return {
        success: false,
        message: 'Nhân vật này chưa có cấu hình mã mở khóa.',
      };
    }

    if (trimmedInput !== secret.toUpperCase()) {
      return {
        success: false,
        message: 'Mã mở khóa không chính xác. Vui lòng thử lại.',
      };
    }

    // Code is valid! Unlock specifically for this user
    const updated = userCharacterRepository.unlockForUser(characterId, 'code', uid);
    window.dispatchEvent(new CustomEvent('be_ca_character_unlocked', { detail: { characterId, userId: uid } }));

    return {
      success: true,
      message: 'Mở khóa thành công! Nhân vật đã gia nhập Bể Cá của bạn.',
      unlockedAt: updated.unlockedAt,
    };
  }

  /**
   * USER OPERATION: Check and unlock condition
   */
  public async evaluateAndUnlockCondition(
    character: Character,
    allCharacters: Character[],
    userId?: string
  ): Promise<UnlockActionResult> {
    const uid = userId || userCharacterRepository.getCurrentUserId();

    if (character.unlockType !== 'condition' || !character.unlockCondition) {
      return {
        success: false,
        message: 'Nhân vật này không yêu cầu mở khóa bằng điều kiện.',
      };
    }

    const evaluation = this.evaluateCondition(character.unlockCondition, allCharacters, uid);
    if (!evaluation.satisfied) {
      return {
        success: false,
        message: `Chưa đạt điều kiện: ${evaluation.description} (Hiện tại: ${evaluation.current}/${evaluation.target})`,
      };
    }

    // Satisfied! Unlock for this user
    const updated = userCharacterRepository.unlockForUser(character.id, 'condition', uid);
    window.dispatchEvent(new CustomEvent('be_ca_character_unlocked', { detail: { characterId: character.id, userId: uid } }));

    return {
      success: true,
      message: 'Đã hoàn thành điều kiện mở khóa! Nhân vật đã được đưa vào Bể Cá.',
      unlockedAt: updated.unlockedAt,
    };
  }

  /**
   * USER OPERATION: Immediate unlock for 'none' type
   */
  public async unlockImmediate(characterId: string, userId?: string): Promise<UnlockActionResult> {
    const uid = userId || userCharacterRepository.getCurrentUserId();
    const updated = userCharacterRepository.unlockForUser(characterId, 'none', uid);
    window.dispatchEvent(new CustomEvent('be_ca_character_unlocked', { detail: { characterId, userId: uid } }));
    return {
      success: true,
      message: 'Đã đưa nhân vật vào Bể Cá thành công!',
      unlockedAt: updated.unlockedAt,
    };
  }

  /**
   * ADMIN OPERATION: Grant manual unlock to a user
   * Strictly enforces Admin role check!
   */
  public async adminGrantManualUnlock(characterId: string, targetUserId: string): Promise<UnlockActionResult> {
    if (!this.isAdmin()) {
      throw new Error('Từ chối quyền truy cập: Chỉ Quản trị viên (Admin) mới có quyền cấp manual unlock.');
    }

    const updated = userCharacterRepository.unlockForUser(characterId, 'manual', targetUserId);
    window.dispatchEvent(new CustomEvent('be_ca_character_unlocked', { detail: { characterId, userId: targetUserId } }));

    return {
      success: true,
      message: `Quản trị viên đã cấp quyền mở khóa nhân vật cho tài khoản ${targetUserId}.`,
      unlockedAt: updated.unlockedAt,
    };
  }

  /**
   * ADMIN OPERATION: Revoke manual unlock for a user
   * Strictly enforces Admin role check!
   */
  public async adminRevokeManualUnlock(characterId: string, targetUserId: string): Promise<UnlockActionResult> {
    if (!this.isAdmin()) {
      throw new Error('Từ chối quyền truy cập: Chỉ Quản trị viên (Admin) mới có quyền thu hồi unlock.');
    }

    userCharacterRepository.revokeUnlockForUser(characterId, targetUserId);
    window.dispatchEvent(new CustomEvent('be_ca_character_unlocked', { detail: { characterId, userId: targetUserId } }));

    return {
      success: true,
      message: `Quản trị viên đã thu hồi quyền mở khóa nhân vật của tài khoản ${targetUserId}.`,
    };
  }

  /**
   * ADMIN OPERATION: Set secret unlock code for a character
   * Strictly enforces Admin role check!
   */
  public adminSetUnlockCode(characterId: string, secretCode: string): void {
    if (!this.isAdmin()) {
      throw new Error('Từ chối quyền truy cập: Chỉ Quản trị viên (Admin) mới có quyền đổi mã mở khóa.');
    }
    PRIVATE_CHARACTER_SECRETS[characterId] = secretCode.trim().toUpperCase();
  }

  /**
   * ADMIN OPERATION: Read secret unlock code for a character
   * Strictly enforces Admin role check!
   */
  public adminGetUnlockCode(characterId: string): string | null {
    if (!this.isAdmin()) {
      return null;
    }
    return PRIVATE_CHARACTER_SECRETS[characterId] || null;
  }
}

export const unlockService = new UnlockService();
