/**
 * Performance Report Generator
 * Generates comprehensive performance reports from backtest results
 */

import { EnhancedBacktestResult } from './EnhancedBacktester';
import { MonthlyPerformance } from '../types';

export interface PerformanceReport {
  summary: {
    strategyName: string;
    period: string;
    initialBalance: number;
    finalBalance: number;
    totalReturn: number;
    totalReturnPercent: number;
    totalTrades: number;
    winRate: number;
    profitFactor: number;
    sharpeRatio: number;
    maxDrawdown: number;
    maxDrawdownPercent: number;
  };
  metrics: {
    profitability: {
      totalProfit: number;
      totalLoss: number;
      netProfit: number;
      averageProfit: number;
      averageLoss: number;
      largestWin: number;
      largestLoss: number;
      expectancy: number;
    };
    risk: {
      maxDrawdown: number;
      maxDrawdownPercent: number;
      maxConsecutiveLosses: number;
      maxConsecutiveWins: number;
      recoveryFactor: number;
      calmarRatio: number;
    };
    performance: {
      sharpeRatio: number;
      sortinoRatio: number;
      winRate: number;
      averageRR: number;
      profitFactor: number;
    };
    timing: {
      averageWinDuration: number; // milliseconds
      averageLossDuration: number; // milliseconds
      maxDrawdownDuration: number; // milliseconds
      recoveryTime: number; // milliseconds
    };
  };
  monthlyBreakdown: Array<{
    month: string;
    performance: string; // "Excellent", "Good", "Poor", etc.
    summary: string;
  }>;
  recommendations: string[];
  warnings: string[];
}

export class PerformanceReportGenerator {
  /**
   * Generate comprehensive performance report
   */
  static generateReport(result: EnhancedBacktestResult): PerformanceReport {
    const totalReturn = result.totalProfitLoss;
    // Estimate initial balance from first trade or use a default
    const estimatedInitialBalance = result.trades.length > 0 && result.trades[0].entryPrice
      ? result.trades[0].entryPrice * (result.trades[0].quantity || 1) * 10 // Rough estimate
      : 10000;
    const totalReturnPercent = estimatedInitialBalance > 0
      ? (totalReturn / estimatedInitialBalance) * 100
      : 0;

    const period = `${result.startDate.toISOString().split('T')[0]} to ${result.endDate.toISOString().split('T')[0]}`;

    // Generate monthly breakdown with performance ratings
    const monthlyBreakdown = result.monthlyBreakdown.map(month => ({
      month: month.month,
      performance: this.rateMonthlyPerformance(month),
      summary: `${month.trades} trades, ${month.winRate.toFixed(1)}% win rate, ${month.pnlPercent >= 0 ? '+' : ''}${month.pnlPercent.toFixed(2)}% return`,
    }));

    // Generate recommendations
    const recommendations = this.generateRecommendations(result);

    // Generate warnings
    const warnings = this.generateWarnings(result);

    return {
      summary: {
        strategyName: result.strategyName,
        period,
        initialBalance: estimatedInitialBalance,
        finalBalance: estimatedInitialBalance + result.totalProfitLoss,
        totalReturn,
        totalReturnPercent,
        totalTrades: result.totalTrades,
        winRate: result.winRate,
        profitFactor: result.profitFactor,
        sharpeRatio: result.sharpeRatio,
        maxDrawdown: result.maxDrawdown,
        maxDrawdownPercent: result.maxDrawdownPercent,
      },
      metrics: {
        profitability: {
          totalProfit: result.averageProfit * result.winningTrades,
          totalLoss: Math.abs(result.averageLoss * result.losingTrades),
          netProfit: result.totalProfitLoss,
          averageProfit: result.averageProfit,
          averageLoss: result.averageLoss,
          largestWin: result.largestWin,
          largestLoss: result.largestLoss,
          expectancy: result.expectancy || 0,
        },
        risk: {
          maxDrawdown: result.maxDrawdown,
          maxDrawdownPercent: result.maxDrawdownPercent,
          maxConsecutiveLosses: result.riskMetrics.maxConsecutiveLosses,
          maxConsecutiveWins: result.riskMetrics.maxConsecutiveWins,
          recoveryFactor: result.recoveryFactor || 0,
          calmarRatio: result.calmarRatio || 0,
        },
        performance: {
          sharpeRatio: result.sharpeRatio,
          sortinoRatio: result.sortinoRatio || 0,
          winRate: result.winRate,
          averageRR: result.averageRR,
          profitFactor: result.profitFactor,
        },
        timing: {
          averageWinDuration: result.averageWinDuration,
          averageLossDuration: result.averageLossDuration,
          maxDrawdownDuration: result.riskMetrics.maxDrawdownDuration,
          recoveryTime: result.riskMetrics.recoveryTime,
        },
      },
      monthlyBreakdown,
      recommendations,
      warnings,
    };
  }

  /**
   * Rate monthly performance
   */
  private static rateMonthlyPerformance(month: MonthlyPerformance): string {
    if (month.pnlPercent >= 10 && month.winRate >= 60) {
      return 'Excellent';
    } else if (month.pnlPercent >= 5 && month.winRate >= 50) {
      return 'Good';
    } else if (month.pnlPercent >= 0 && month.winRate >= 45) {
      return 'Average';
    } else if (month.pnlPercent >= -5) {
      return 'Poor';
    } else {
      return 'Very Poor';
    }
  }

  /**
   * Generate recommendations based on results
   */
  private static generateRecommendations(result: EnhancedBacktestResult): string[] {
    const recommendations: string[] = [];

    // Win rate recommendations
    if (result.winRate < 40) {
      recommendations.push('Consider improving entry signals - win rate is below 40%');
    } else if (result.winRate >= 60) {
      recommendations.push('Excellent win rate - consider increasing position size slightly');
    }

    // Profit factor recommendations
    if (result.profitFactor < 1.2) {
      recommendations.push('Profit factor is low - consider improving risk/reward ratio');
    } else if (result.profitFactor >= 2) {
      recommendations.push('Strong profit factor - strategy shows good profitability');
    }

    // Drawdown recommendations
    if (result.maxDrawdownPercent > 20) {
      recommendations.push('High drawdown detected - consider tighter risk management');
    }

    // Sharpe ratio recommendations
    if (result.sharpeRatio < 1) {
      recommendations.push('Sharpe ratio below 1 - returns may not justify the risk');
    } else if (result.sharpeRatio >= 2) {
      recommendations.push('Excellent Sharpe ratio - strategy shows consistent risk-adjusted returns');
    }

    // Consecutive losses
    if (result.riskMetrics.maxConsecutiveLosses > 5) {
      recommendations.push('High consecutive losses - consider adding filters to reduce losing streaks');
    }

    // Average RR
    if (result.averageRR < 1) {
      recommendations.push('Average risk/reward below 1:1 - consider adjusting take profit levels');
    }

    // Monthly consistency
    const negativeMonths = result.monthlyBreakdown.filter(m => m.pnlPercent < 0).length;
    if (negativeMonths > result.monthlyBreakdown.length * 0.4) {
      recommendations.push('High number of negative months - strategy may lack consistency');
    }

    return recommendations;
  }

  /**
   * Generate warnings based on results
   */
  private static generateWarnings(result: EnhancedBacktestResult): string[] {
    const warnings: string[] = [];

    // Critical warnings
    if (result.totalProfitLoss < 0) {
      warnings.push('⚠️ Strategy is unprofitable - do not use in live trading');
    }

    if (result.maxDrawdownPercent > 30) {
      warnings.push('⚠️ Very high drawdown - risk of significant account loss');
    }

    if (result.winRate < 30) {
      warnings.push('⚠️ Very low win rate - strategy may not be viable');
    }

    if (result.profitFactor < 1) {
      warnings.push('⚠️ Profit factor below 1 - losses exceed profits');
    }

    if (result.riskMetrics.maxConsecutiveLosses > 10) {
      warnings.push('⚠️ Very high consecutive losses - account may be at risk');
    }

    // Moderate warnings
    if (result.sharpeRatio < 0.5) {
      warnings.push('Low Sharpe ratio - risk-adjusted returns are poor');
    }

    if (result.averageRR < 0.5) {
      warnings.push('Low average risk/reward - consider improving exit strategy');
    }

    if (result.totalTrades < 30) {
      warnings.push('Low number of trades - results may not be statistically significant');
    }

    return warnings;
  }

  /**
   * Generate markdown report
   */
  static generateMarkdownReport(result: EnhancedBacktestResult): string {
    const report = this.generateReport(result);

    let markdown = `# Backtest Performance Report\n\n`;
    markdown += `## Strategy: ${report.summary.strategyName}\n`;
    markdown += `**Period:** ${report.summary.period}\n\n`;

    // Summary
    markdown += `## Summary\n\n`;
    markdown += `- **Total Return:** ${report.summary.totalReturnPercent.toFixed(2)}%\n`;
    markdown += `- **Total Trades:** ${report.summary.totalTrades}\n`;
    markdown += `- **Win Rate:** ${report.summary.winRate.toFixed(2)}%\n`;
    markdown += `- **Profit Factor:** ${report.summary.profitFactor.toFixed(2)}\n`;
    markdown += `- **Sharpe Ratio:** ${report.summary.sharpeRatio.toFixed(2)}\n`;
    markdown += `- **Max Drawdown:** ${report.summary.maxDrawdownPercent.toFixed(2)}%\n\n`;

    // Metrics
    markdown += `## Key Metrics\n\n`;
    markdown += `### Profitability\n`;
    markdown += `- Total Profit: $${report.metrics.profitability.totalProfit.toFixed(2)}\n`;
    markdown += `- Total Loss: $${report.metrics.profitability.totalLoss.toFixed(2)}\n`;
    markdown += `- Average Win: $${report.metrics.profitability.averageProfit.toFixed(2)}\n`;
    markdown += `- Average Loss: $${report.metrics.profitability.averageLoss.toFixed(2)}\n`;
    markdown += `- Expectancy: $${report.metrics.profitability.expectancy.toFixed(2)}\n\n`;

    markdown += `### Risk Metrics\n`;
    markdown += `- Max Drawdown: ${report.metrics.risk.maxDrawdownPercent.toFixed(2)}%\n`;
    markdown += `- Max Consecutive Losses: ${report.metrics.risk.maxConsecutiveLosses}\n`;
    markdown += `- Recovery Factor: ${report.metrics.risk.recoveryFactor.toFixed(2)}\n\n`;

    // Monthly Breakdown
    markdown += `## Monthly Performance\n\n`;
    markdown += `| Month | Performance | Summary |\n`;
    markdown += `|-------|-------------|----------|\n`;
    for (const month of report.monthlyBreakdown) {
      markdown += `| ${month.month} | ${month.performance} | ${month.summary} |\n`;
    }
    markdown += `\n`;

    // Recommendations
    if (report.recommendations.length > 0) {
      markdown += `## Recommendations\n\n`;
      for (const rec of report.recommendations) {
        markdown += `- ${rec}\n`;
      }
      markdown += `\n`;
    }

    // Warnings
    if (report.warnings.length > 0) {
      markdown += `## ⚠️ Warnings\n\n`;
      for (const warning of report.warnings) {
        markdown += `- ${warning}\n`;
      }
      markdown += `\n`;
    }

    return markdown;
  }
}

