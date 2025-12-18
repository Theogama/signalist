/**
 * Convert XML bots to TypeScript strategies
 * Usage: npx ts-node scripts/convert-xml-bots.ts
 */

import { StrategyGenerator } from '../lib/auto-trading/parsers/StrategyGenerator';
import * as fs from 'fs';
import * as path from 'path';

const BOTS_DIR = path.join(__dirname, '../freetradingbots-main');
const OUTPUT_DIR = path.join(__dirname, '../lib/auto-trading/strategies/generated');

// Priority bots to convert
const PRIORITY_BOTS = [
  'BOT - 0001 - Even_Odd -  MG with Stop X.xml',
  'BOT - 0002 - Rise-Fall - Candle Close-Open - MG.xml',
  'BOT - 0003 - Digits Analyzer - MG.xml',
  'BOT - 0008 - Over Under.xml',
  'Even Odd Bot.xml',
  'SMART RISE AND FALL BOT(1).xml',
  'Last Digit Bot.xml',
  'Two consecutive Digits Bot.xml',
  'Profit bot (1).xml',
];

function main() {
  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const generator = new StrategyGenerator();
  const converted: string[] = [];
  const errors: Array<{ file: string; error: string }> = [];

  // Convert priority bots first
  console.log('Converting priority bots...\n');
  for (const botFile of PRIORITY_BOTS) {
    const filePath = path.join(BOTS_DIR, botFile);
    if (fs.existsSync(filePath)) {
      try {
        console.log(`Converting: ${botFile}`);
        const outputPath = generator.generateFromXml(filePath, OUTPUT_DIR);
        converted.push(botFile);
        console.log(`  ✓ Generated: ${path.basename(outputPath)}\n`);
      } catch (error: any) {
        console.error(`  ✗ Error: ${error.message}\n`);
        errors.push({ file: botFile, error: error.message });
      }
    } else {
      console.log(`  ⚠ File not found: ${botFile}\n`);
    }
  }

  // Convert remaining bots
  console.log('\nConverting remaining bots...\n');
  const allFiles = fs.readdirSync(BOTS_DIR).filter(f => f.endsWith('.xml'));
  const remainingFiles = allFiles.filter(f => !PRIORITY_BOTS.includes(f));

  for (const botFile of remainingFiles) {
    const filePath = path.join(BOTS_DIR, botFile);
    try {
      console.log(`Converting: ${botFile}`);
      const outputPath = generator.generateFromXml(filePath, OUTPUT_DIR);
      converted.push(botFile);
      console.log(`  ✓ Generated: ${path.basename(outputPath)}\n`);
    } catch (error: any) {
      console.error(`  ✗ Error: ${error.message}\n`);
      errors.push({ file: botFile, error: error.message });
    }
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('Conversion Summary');
  console.log('='.repeat(50));
  console.log(`Total converted: ${converted.length}`);
  console.log(`Errors: ${errors.length}`);

  if (errors.length > 0) {
    console.log('\nErrors:');
    errors.forEach(({ file, error }) => {
      console.log(`  - ${file}: ${error}`);
    });
  }

  // Generate index file
  generateIndexFile(converted);
}

function generateIndexFile(converted: string[]) {
  const indexContent = `/**
 * Generated Strategy Index
 * Auto-generated from XML bot conversions
 * 
 * Total strategies: ${converted.length}
 * Generated: ${new Date().toISOString()}
 */

${converted.map((file, index) => {
    const className = file
      .replace(/[^a-zA-Z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('') + 'Strategy';
    
    const fileName = file
      .replace(/[^a-zA-Z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '') + '.ts';

    return `export { ${className} } from './generated/${fileName.replace('.ts', '')}';`;
  }).join('\n')}
`;

  const indexPath = path.join(__dirname, '../lib/auto-trading/strategies/generated/index.ts');
  fs.writeFileSync(indexPath, indexContent, 'utf-8');
  console.log(`\n✓ Generated index file: ${indexPath}`);
}

if (require.main === module) {
  main();
}







