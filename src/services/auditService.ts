import { AuditLogEntry } from '../types';
import { musicService } from './musicService';

const STORAGE_KEY_AUDIT = 'be_ca_audit_logs_v1';

class AuditService {
  private loadLogs(): AuditLogEntry[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_AUDIT);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return [];
  }

  private saveLogs(logs: AuditLogEntry[]): void {
    try {
      localStorage.setItem(STORAGE_KEY_AUDIT, JSON.stringify(logs.slice(0, 100)));
      window.dispatchEvent(new CustomEvent('be_ca_audit_logged'));
    } catch {
      // ignore
    }
  }

  public log(
    action: string,
    entity: 'character' | 'tag' | 'music' | 'unlock' | 'user',
    details: string,
    adminId?: string
  ): void {
    const logs = this.loadLogs();
    const newEntry: AuditLogEntry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      adminId: adminId || (musicService.isAdminUser() ? 'admin' : 'system'),
      action,
      entity,
      details,
    };
    this.saveLogs([newEntry, ...logs]);
  }

  public getRecentLogs(limit = 20): AuditLogEntry[] {
    return this.loadLogs().slice(0, limit);
  }

  public clearLogs(): void {
    this.saveLogs([]);
  }
}

export const auditService = new AuditService();
