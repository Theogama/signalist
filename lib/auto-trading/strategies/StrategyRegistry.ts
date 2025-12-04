/**
 * Strategy Registry
 * Manages available strategies and their configurations
 */

import { IStrategy } from '../interfaces';
import { StrategyConfig } from '../types';
import { EvenOddStrategy } from './EvenOddStrategy';
import { RiseFallStrategy } from './RiseFallStrategy';
import { DigitsStrategy } from './DigitsStrategy';
import { BaseStrategy } from './BaseStrategy';

export type StrategyFactory = (config: any) => IStrategy;

export class StrategyRegistry {
  private strategies: Map<string, StrategyFactory> = new Map();

  constructor() {
    this.registerDefaultStrategies();
  }

  /**
   * Register default strategies
   */
  private registerDefaultStrategies(): void {
    this.register('EvenOdd', (config) => new EvenOddStrategy(config));
    this.register('RiseFall', (config) => new RiseFallStrategy(config));
    this.register('Digits', (config) => new DigitsStrategy(config));
  }

  /**
   * Register a strategy factory
   */
  register(name: string, factory: StrategyFactory): void {
    this.strategies.set(name, factory);
  }

  /**
   * Create a strategy instance
   */
  create(name: string, config: any): IStrategy {
    const factory = this.strategies.get(name);
    if (!factory) {
      throw new Error(`Strategy "${name}" not found. Available strategies: ${Array.from(this.strategies.keys()).join(', ')}`);
    }

    return factory(config);
  }

  /**
   * Get list of available strategies
   */
  list(): string[] {
    return Array.from(this.strategies.keys());
  }

  /**
   * Check if strategy exists
   */
  has(name: string): boolean {
    return this.strategies.has(name);
  }

  /**
   * Load strategies from generated folder
   */
  async loadGeneratedStrategies(): Promise<void> {
    try {
      // Dynamic import of generated strategies
      // This allows loading strategies converted from XML
      // Use try-catch to handle missing generated folder gracefully
      let generatedIndex: any = null;
      
      try {
        // Use dynamic import with explicit path to avoid webpack issues
        generatedIndex = await import('./generated/index');
      } catch (importError: any) {
        // Module not found or empty - this is expected if no XML bots have been converted
        if (importError?.code === 'MODULE_NOT_FOUND' || importError?.message?.includes('Cannot resolve')) {
          console.warn('Generated strategies not found. Run convert-xml-bots.ts first.');
          return;
        }
        // Re-throw other errors
        throw importError;
      }
      
      if (!generatedIndex || Object.keys(generatedIndex).length === 0) {
        console.warn('Generated strategies index is empty. Run convert-xml-bots.ts first.');
        return;
      }
      
      // Register each generated strategy
      for (const [name, StrategyClass] of Object.entries(generatedIndex)) {
        if (name.endsWith('Strategy') && typeof StrategyClass === 'function') {
          const strategyName = name.replace('Strategy', '');
          this.register(strategyName, (config) => new (StrategyClass as any)(config));
        }
      }
    } catch (error: any) {
      // Generated strategies not available yet
      console.warn('Generated strategies not found. Run convert-xml-bots.ts first.', error?.message || error);
    }
  }
}

// Singleton instance
export const strategyRegistry = new StrategyRegistry();



