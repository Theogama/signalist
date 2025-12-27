/**
 * Unit tests for risk sizing calculations
 */

import { MT5Adapter } from '../adapters/mt5-adapter';
import { DerivAdapter } from '../adapters/deriv-adapter';

describe('Risk Sizing Calculations', () => {
  describe('MT5Adapter - Lot Calculation', () => {
    let adapter: MT5Adapter;

    beforeEach(async () => {
      adapter = new MT5Adapter();
      await adapter.initialize({
        broker: 'exness',
        mt5Login: 12345678,
        mt5Password: 'test',
        mt5Server: 'Exness-MT5Real',
      });
    });

    it('should calculate lot size based on risk percentage', async () => {
      const lotSize = await adapter.computeLotFromRisk(
        10, // 10% risk
        10000, // $10,000 balance
        2000, // Entry price
        1990, // Stop loss (10 points away)
        'XAUUSD'
      );

      // Risk amount = $1,000 (10% of $10,000)
      // Lot size should be calculated to risk $1,000 if SL is hit
      expect(lotSize).toBeGreaterThan(0);
      expect(lotSize).toBeLessThanOrEqual(100); // Max lot
      expect(lotSize).toBeGreaterThanOrEqual(0.01); // Min lot
    });

    it('should respect minimum lot size', async () => {
      const lotSize = await adapter.computeLotFromRisk(
        0.1, // Very small risk
        100, // Small balance
        2000,
        1999.9, // Very close SL
        'XAUUSD'
      );

      expect(lotSize).toBeGreaterThanOrEqual(0.01); // Minimum lot
    });

    it('should respect maximum lot size', async () => {
      const lotSize = await adapter.computeLotFromRisk(
        50, // High risk
        100000, // Large balance
        2000,
        1800, // Far SL (200 points)
        'XAUUSD'
      );

      expect(lotSize).toBeLessThanOrEqual(100); // Maximum lot
    });

    it('should handle zero stop loss distance', async () => {
      const lotSize = await adapter.computeLotFromRisk(
        10,
        10000,
        2000,
        2000, // Same as entry (invalid but should handle)
        'XAUUSD'
      );

      // Should return minimum lot when SL distance is 0
      expect(lotSize).toBeGreaterThanOrEqual(0.01);
    });
  });

  describe('DerivAdapter - Stake Calculation', () => {
    let adapter: DerivAdapter;

    beforeEach(async () => {
      adapter = new DerivAdapter();
      await adapter.initialize({
        broker: 'deriv',
        derivToken: 'test-token',
      });
    });

    it('should calculate stake based on risk percentage', async () => {
      const stake = await adapter.computeStakeFromRisk(
        10, // 10% risk
        10000, // $10,000 balance
        'BOOM1000'
      );

      // Risk amount = $1,000
      // For Deriv, stake is direct amount
      expect(stake).toBe(1000);
    });

    it('should respect minimum stake ($1)', async () => {
      const stake = await adapter.computeStakeFromRisk(
        0.01, // Very small risk
        100, // Small balance
        'BOOM1000'
      );

      // Should be at least $1
      expect(stake).toBeGreaterThanOrEqual(1);
    });

    it('should floor stake to whole dollars', async () => {
      const stake = await adapter.computeStakeFromRisk(
        10.5, // 10.5% risk
        10000,
        'BOOM1000'
      );

      // Should be floored to whole number
      expect(stake).toBe(Math.floor(stake));
    });

    it('should handle different risk percentages', async () => {
      const testCases = [
        { risk: 1, balance: 10000, expected: 100 },
        { risk: 5, balance: 10000, expected: 500 },
        { risk: 20, balance: 10000, expected: 2000 },
        { risk: 50, balance: 10000, expected: 5000 },
      ];

      for (const testCase of testCases) {
        const stake = await adapter.computeStakeFromRisk(
          testCase.risk,
          testCase.balance,
          'BOOM1000'
        );
        expect(stake).toBe(testCase.expected);
      }
    });
  });

  describe('Risk Percentage Validation', () => {
    it('should handle edge cases for risk percentages', async () => {
      const adapter = new MT5Adapter();
      await adapter.initialize({
        broker: 'exness',
        mt5Login: 12345678,
        mt5Password: 'test',
        mt5Server: 'Exness-MT5Real',
      });

      // Test minimum risk (1%)
      const minLot = await adapter.computeLotFromRisk(
        1,
        10000,
        2000,
        1990,
        'XAUUSD'
      );
      expect(minLot).toBeGreaterThan(0);

      // Test maximum risk (50%)
      const maxLot = await adapter.computeLotFromRisk(
        50,
        10000,
        2000,
        1990,
        'XAUUSD'
      );
      expect(maxLot).toBeGreaterThan(minLot);
      expect(maxLot).toBeLessThanOrEqual(100);
    });
  });
});









