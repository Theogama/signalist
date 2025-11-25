/**
 * Strategy Loader
 * Utility to load and register strategies from generated files
 */

import { StrategyRegistry, strategyRegistry } from './StrategyRegistry';
import * as fs from 'fs';
import * as path from 'path';

export class StrategyLoader {
  private registry: StrategyRegistry;
  private generatedDir: string;

  constructor(registry: StrategyRegistry = strategyRegistry) {
    this.registry = registry;
    // Use process.cwd() for Next.js compatibility, fallback to __dirname if available
    const baseDir = typeof __dirname !== 'undefined' ? __dirname : process.cwd();
    this.generatedDir = path.join(baseDir, 'lib', 'auto-trading', 'strategies', 'generated');
  }

  /**
   * Load all generated strategies
   */
  async loadAll(): Promise<{ loaded: number; errors: string[] }> {
    const errors: string[] = [];
    let loaded = 0;

    if (!fs.existsSync(this.generatedDir)) {
      return { loaded: 0, errors: ['Generated strategies directory not found'] };
    }

    const files = fs.readdirSync(this.generatedDir).filter(f => f.endsWith('.ts') && f !== 'index.ts');

    for (const file of files) {
      try {
        await this.loadStrategy(file);
        loaded++;
      } catch (error: any) {
        errors.push(`${file}: ${error.message}`);
      }
    }

    return { loaded, errors };
  }

  /**
   * Load a specific strategy file
   */
  private async loadStrategy(fileName: string): Promise<void> {
    const filePath = path.join(this.generatedDir, fileName);
    const moduleName = `./generated/${fileName.replace('.ts', '')}`;

    try {
      // Dynamic import - only if generated directory exists
      if (!fs.existsSync(filePath)) {
        throw new Error(`Strategy file not found: ${filePath}`);
      }
      
      // Try to import the module - handle both .ts and .js extensions
      let module;
      try {
        module = await import(moduleName);
      } catch (importError: any) {
        // If import fails, try without extension
        const moduleNameNoExt = `./generated/${fileName.replace(/\.(ts|js)$/, '')}`;
        try {
          module = await import(moduleNameNoExt);
        } catch {
          throw new Error(`Failed to import ${fileName}: ${importError.message}`);
        }
      }
      
      // Find exported strategy class
      for (const [exportName, ExportClass] of Object.entries(module)) {
        if (exportName.endsWith('Strategy') && typeof ExportClass === 'function') {
          const strategyName = exportName.replace('Strategy', '');
          
          // Register factory
          this.registry.register(strategyName, (config: any) => {
            return new (ExportClass as any)(config);
          });
          
          break;
        }
      }
    } catch (error: any) {
      throw new Error(`Failed to load ${fileName}: ${error.message}`);
    }
  }

  /**
   * Get list of available strategy files
   */
  getAvailableStrategies(): string[] {
    if (!fs.existsSync(this.generatedDir)) {
      return [];
    }

    return fs.readdirSync(this.generatedDir)
      .filter(f => f.endsWith('.ts') && f !== 'index.ts')
      .map(f => f.replace('.ts', ''));
  }

  /**
   * Check if strategies have been generated
   */
  hasGeneratedStrategies(): boolean {
    return fs.existsSync(this.generatedDir) && 
           fs.readdirSync(this.generatedDir).filter(f => f.endsWith('.ts')).length > 1;
  }
}

export const strategyLoader = new StrategyLoader();



