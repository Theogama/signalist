/**
 * Unit tests for RiskManager
 */

import { RiskManager } from '../risk-manager/RiskManager';
import { StrategySignal, Position } from '../types';

describe('RiskManager', () => {
  let riskManager: RiskManager;

  beforeEach(() => {
    riskManager = new RiskManager({
      maxRiskPerTrade: 1,
      maxDailyLoss: 10,
      maxDrawdown: 20,
      maxConcurrentPositions: 3,
      maxPositionSize: 10,
      minAccountBalance: 1000,
    });
  });

  describe('canTrade', () => {
    it('should allow trade within limits', async () => {
      const signal: StrategySignal = {
        symbol: 'XAUUSD',
        side: 'BUY',
        entryPrice: 2000,
        stopLoss: 1980,
        quantity: 0.01,
        timestamp: new Date(),
      };

      const canTrade = await riskManager.canTrade(signal, 10000, []);
      expect(canTrade).toBe(true);
    });

    it('should reject trade if max concurrent positions reached', async () => {
      const signal: StrategySignal = {
        symbol: 'XAUUSD',
        side: 'BUY',
        entryPrice: 2000,
        timestamp: new Date(),
      };

      const openPositions: Position[] = [
        { positionId: '1', symbol: 'XAUUSD', side: 'BUY', quantity: 1, entryPrice: 2000, currentPrice: 2000, unrealizedPnl: 0, unrealizedPnlPercent: 0, status: 'OPEN', openedAt: new Date() },
        { positionId: '2', symbol: 'US30', side: 'BUY', quantity: 1, entryPrice: 35000, currentPrice: 35000, unrealizedPnl: 0, unrealizedPnlPercent: 0, status: 'OPEN', openedAt: new Date() },
        { positionId: '3', symbol: 'NAS100', side: 'BUY', quantity: 1, entryPrice: 15000, currentPrice: 15000, unrealizedPnl: 0, unrealizedPnlPercent: 0, status: 'OPEN', openedAt: new Date() },
      ];

      const canTrade = await riskManager.canTrade(signal, 10000, openPositions);
      expect(canTrade).toBe(false);
    });
  });

  describe('calculateMaxPositionSize', () => {
    it('should calculate position size based on risk', () => {
      const maxSize = riskManager.calculateMaxPositionSize(10000, 1, 2000, 1980);
      expect(maxSize).toBeGreaterThan(0);
    });
  });

  describe('checkDailyLoss', () => {
    it('should allow trading if daily loss is within limit', () => {
      const allowed = riskManager.checkDailyLoss(10000, -500);
      expect(allowed).toBe(true);
    });

    it('should reject trading if daily loss exceeds limit', () => {
      const allowed = riskManager.checkDailyLoss(10000, -1500); // 15% loss
      expect(allowed).toBe(false);
    });
  });
});




