/**
 * Demo Deriv Service Usage Examples
 * 
 * Examples showing how to use the demo trading simulator
 */

import { startBot, type BotExecutionConfig } from '@/lib/services/bot-execution-engine.service';
import { DemoDerivService } from '@/lib/services/demo-deriv.service';
import { mockTradeGenerator } from '@/lib/services/mock-trade-generator.service';
import { fakeAnalyticsService } from '@/lib/services/fake-analytics.service';

/**
 * Example 1: Start bot in demo mode
 */
export async function example1_StartBotInDemoMode() {
  const config: BotExecutionConfig = {
    userId: 'user123',
    botId: 'demo-bot-1',
    symbol: 'BOOM500',
    contractType: 'CALL',
    stake: 10,
    duration: 5,
    durationUnit: 'm',
    
    // Enable demo mode
    demoMode: true,
    demoInitialBalance: 10000, // Start with $10,000
    
    // Risk settings still apply in demo mode
    riskSettings: {
      stopLossEnabled: true,
      stopLossPercent: 50,
      maxTradesPerDay: 50,
      maxDailyLoss: 100,
    },
  };

  await startBot(config);
  console.log('Demo bot started!');
}

/**
 * Example 2: Use demo service directly
 */
export async function example2_UseDemoServiceDirectly() {
  const userId = 'user123';
  const demoService = new DemoDerivService(userId, 10000);

  // Connect
  await demoService.connect();

  // Get account info
  const accountInfo = await demoService.getAccountInfo();
  console.log('Demo account balance:', accountInfo.balance);

  // Get proposal
  const proposal = await demoService.getProposal({
    symbol: 'BOOM500',
    contract_type: 'CALL',
    amount: 10,
    duration: 5,
    duration_unit: 'm',
  });

  console.log('Proposal:', proposal);

  // Buy contract
  const buyResponse = await demoService.buyContract({
    symbol: 'BOOM500',
    contract_type: 'CALL',
    amount: 10,
    duration: 5,
    duration_unit: 'm',
  });

  console.log('Buy response:', buyResponse);

  // Listen for contract updates
  if (buyResponse.buy) {
    await demoService.subscribeToContract(
      buyResponse.buy.contract_id,
      (contract) => {
        console.log('Contract update:', contract);
        if (contract.status !== 'open') {
          console.log('Contract settled:', contract.status);
          console.log('Profit/Loss:', contract.profit);
        }
      }
    );
  }

  // Get updated balance after some time
  setTimeout(async () => {
    const updatedInfo = await demoService.getAccountInfo();
    console.log('Updated balance:', updatedInfo.balance);
  }, 6000); // Wait 6 seconds for contract to settle
}

/**
 * Example 3: Generate mock trade outcomes
 */
export function example3_GenerateMockTrades() {
  // Generate single outcome
  const outcome = mockTradeGenerator.generateOutcome(10, 'CALL', 'BOOM500');
  console.log('Trade outcome:', outcome);

  // Generate multiple outcomes for backtesting
  const outcomes = mockTradeGenerator.generateMultipleOutcomes(100, 10, 'CALL', 'BOOM500');
  console.log(`Generated ${outcomes.length} outcomes`);
  
  const wins = outcomes.filter(o => o.willWin).length;
  const losses = outcomes.filter(o => !o.willWin).length;
  const totalProfit = outcomes.reduce((sum, o) => sum + o.profitLoss, 0);
  
  console.log(`Wins: ${wins}, Losses: ${losses}`);
  console.log(`Total P/L: $${totalProfit.toFixed(2)}`);
  console.log(`Win Rate: ${((wins / outcomes.length) * 100).toFixed(2)}%`);
}

/**
 * Example 4: Generate fake analytics data
 */
export function example4_GenerateAnalytics() {
  // Generate trading statistics
  const stats = fakeAnalyticsService.generateStatistics(100, 0.55);
  console.log('Trading Statistics:', stats);

  // Generate daily performance
  const dailyPerf = fakeAnalyticsService.generateDailyPerformance(30, 0.55);
  console.log('Daily Performance (last 30 days):', dailyPerf);

  // Generate trade history
  const history = fakeAnalyticsService.generateTradeHistory(50, 0.55);
  console.log('Trade History:', history.slice(0, 10)); // Show first 10

  // Generate performance metrics
  const metrics = fakeAnalyticsService.generatePerformanceMetrics(10000, 12000);
  console.log('Performance Metrics:', metrics);

  // Generate portfolio summary
  const portfolio = fakeAnalyticsService.generatePortfolioSummary(10000, 12000);
  console.log('Portfolio Summary:', portfolio);

  // Generate symbol performance
  const symbolPerf = fakeAnalyticsService.generateSymbolPerformance();
  console.log('Symbol Performance:', symbolPerf);
}

/**
 * Example 5: Complete demo trading flow
 */
export async function example5_CompleteDemoFlow() {
  const userId = 'user123';
  const demoService = new DemoDerivService(userId, 10000, {
    winRate: 0.6, // 60% win rate
    volatility: 0.25, // Lower volatility
    minProfitPercent: 60,
    maxProfitPercent: 150,
  });

  await demoService.connect();

  // Execute 10 trades
  for (let i = 0; i < 10; i++) {
    const proposal = await demoService.getProposal({
      symbol: 'BOOM500',
      contract_type: i % 2 === 0 ? 'CALL' : 'PUT',
      amount: 10,
      duration: 5,
      duration_unit: 'm',
    });

    if (proposal.success && proposal.proposal) {
      const buyResponse = await demoService.buyContract({
        symbol: 'BOOM500',
        contract_type: i % 2 === 0 ? 'CALL' : 'PUT',
        amount: 10,
        duration: 5,
        duration_unit: 'm',
      });

      if (buyResponse.buy) {
        console.log(`Trade ${i + 1}: Contract ${buyResponse.buy.contract_id} opened`);
        
        // Wait for contract to settle
        await new Promise(resolve => setTimeout(resolve, 6000));
      }
    }

    // Small delay between trades
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Get final balance
  const finalBalance = await demoService.getAccountInfo();
  console.log('Final balance:', finalBalance.balance);
  console.log('Total P/L:', finalBalance.balance - 10000);

  await demoService.disconnect();
}

/**
 * Example 6: Reset demo account
 */
export async function example6_ResetDemoAccount() {
  const userId = 'user123';
  const demoService = new DemoDerivService(userId, 10000);

  await demoService.connect();

  // Reset balance to $10,000
  await demoService.resetBalance(10000);
  console.log('Demo account reset to $10,000');

  await demoService.disconnect();
}


