/**
 * Settings Synchronization Service
 * Ensures auto-trade settings are synchronized across dashboard, auto-trade panel, and live trading screen
 */

import { AutoTradeSettings } from '@/components/autotrade/AutoTradeSettingsPanel';

export interface SyncedSettings extends AutoTradeSettings {
  userId: string;
  lastSyncedAt: Date;
  version: number; // For conflict resolution
}

class SettingsSyncService {
  private settingsCache: Map<string, SyncedSettings> = new Map();

  /**
   * Get settings for a user
   */
  async getSettings(userId: string): Promise<AutoTradeSettings | null> {
    // Check cache first
    const cached = this.settingsCache.get(userId);
    if (cached) {
      return this.extractSettings(cached);
    }

    // Try to fetch from API
    try {
      const response = await fetch('/api/auto-trading/settings');
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          const settings = data.data as AutoTradeSettings;
          this.settingsCache.set(userId, {
            ...settings,
            userId,
            lastSyncedAt: new Date(),
            version: 1,
          });
          return settings;
        }
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }

    return null;
  }

  /**
   * Save settings and sync across all components
   */
  async saveSettings(userId: string, settings: AutoTradeSettings): Promise<boolean> {
    try {
      const response = await fetch('/api/auto-trading/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Update cache
          const cached = this.settingsCache.get(userId);
          this.settingsCache.set(userId, {
            ...settings,
            userId,
            lastSyncedAt: new Date(),
            version: (cached?.version || 0) + 1,
          });

          // Broadcast settings update to all components
          this.broadcastSettingsUpdate(settings);
          return true;
        }
      }
    } catch (error) {
      console.error('Error saving settings:', error);
    }

    return false;
  }

  /**
   * Broadcast settings update to all listening components
   */
  private broadcastSettingsUpdate(settings: AutoTradeSettings): void {
    // Use CustomEvent to broadcast settings updates
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('autotrade-settings-updated', {
          detail: settings,
        })
      );
    }
  }

  /**
   * Subscribe to settings updates
   */
  subscribe(callback: (settings: AutoTradeSettings) => void): () => void {
    if (typeof window === 'undefined') {
      return () => {}; // Return no-op unsubscribe for SSR
    }

    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<AutoTradeSettings>;
      callback(customEvent.detail);
    };

    window.addEventListener('autotrade-settings-updated', handler);

    // Return unsubscribe function
    return () => {
      window.removeEventListener('autotrade-settings-updated', handler);
    };
  }

  /**
   * Extract settings from synced settings (remove internal fields)
   */
  private extractSettings(synced: SyncedSettings): AutoTradeSettings {
    const { userId, lastSyncedAt, version, ...settings } = synced;
    return settings;
  }

  /**
   * Clear cache for a user (useful on logout)
   */
  clearCache(userId: string): void {
    this.settingsCache.delete(userId);
  }

  /**
   * Get cached settings version (for conflict detection)
   */
  getCachedVersion(userId: string): number {
    const cached = this.settingsCache.get(userId);
    return cached?.version || 0;
  }
}

export const settingsSyncService = new SettingsSyncService();




