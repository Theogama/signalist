/**
 * Trading Session Checker
 * Validates if trading is allowed based on session settings
 */

export interface TradingSessionConfig {
  enabled: boolean;
  sessionStart?: string; // HH:MM format
  sessionEnd?: string; // HH:MM format
}

export class TradingSessionChecker {
  /**
   * Check if trading is allowed based on session settings
   */
  static isTradingAllowed(config: TradingSessionConfig): boolean {
    // If session is not enabled, trading is always allowed
    if (!config.enabled || !config.sessionStart || !config.sessionEnd) {
      return true;
    }

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes(); // Minutes since midnight

    // Parse session times
    const [startHour, startMin] = config.sessionStart.split(':').map(Number);
    const [endHour, endMin] = config.sessionEnd.split(':').map(Number);

    const sessionStart = startHour * 60 + startMin;
    const sessionEnd = endHour * 60 + endMin;

    // Handle sessions that span midnight
    if (sessionStart > sessionEnd) {
      // Session spans midnight (e.g., 22:00 - 06:00)
      return currentTime >= sessionStart || currentTime <= sessionEnd;
    } else {
      // Normal session (e.g., 09:00 - 17:00)
      return currentTime >= sessionStart && currentTime <= sessionEnd;
    }
  }

  /**
   * Get time until session starts
   */
  static getTimeUntilSessionStart(config: TradingSessionConfig): number | null {
    if (!config.enabled || !config.sessionStart) {
      return null;
    }

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    const [startHour, startMin] = config.sessionStart.split(':').map(Number);
    let sessionStart = startHour * 60 + startMin;

    // If session has already started today, calculate for tomorrow
    if (currentTime > sessionStart) {
      sessionStart += 24 * 60; // Add 24 hours
    }

    return sessionStart - currentTime; // Minutes until session starts
  }

  /**
   * Get time until session ends
   */
  static getTimeUntilSessionEnd(config: TradingSessionConfig): number | null {
    if (!config.enabled || !config.sessionEnd) {
      return null;
    }

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    const [endHour, endMin] = config.sessionEnd.split(':').map(Number);
    let sessionEnd = endHour * 60 + endMin;

    // If session already ended today, return null
    const [startHour, startMin] = (config.sessionStart || '00:00').split(':').map(Number);
    const sessionStart = startHour * 60 + startMin;

    // Handle sessions that span midnight
    if (sessionStart > sessionEnd) {
      // Session spans midnight
      if (currentTime < sessionStart && currentTime > sessionEnd) {
        // We're outside the session
        return null;
      }
      if (currentTime <= sessionEnd) {
        // We're in the part after midnight
        return sessionEnd - currentTime;
      }
      // We're in the part before midnight, calculate to next day's end
      sessionEnd += 24 * 60;
    }

    if (currentTime > sessionEnd) {
      return null; // Session already ended
    }

    return sessionEnd - currentTime; // Minutes until session ends
  }
}




