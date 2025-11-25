/**
 * Smart Execution Utilities
 * Retry logic, order confirmation, slippage reduction, latency protection
 */

import { OrderRequest, OrderResponse, OrderStatus, IBrokerAdapter } from '../types';

export interface ExecutionConfig {
  maxRetries?: number;
  retryDelay?: number; // milliseconds
  confirmTimeout?: number; // milliseconds - timeout for order confirmation
  maxSlippagePercent?: number; // Maximum acceptable slippage
  latencyThreshold?: number; // milliseconds - cancel order if latency too high
  spreadCheck?: boolean; // Check spread before execution
  maxSpreadPercent?: number; // Maximum spread before rejecting
}

export interface ExecutionResult {
  success: boolean;
  orderResponse?: OrderResponse;
  error?: string;
  retries?: number;
  latency?: number;
  slippage?: number;
}

/**
 * Execute order with retry logic
 */
export async function executeOrderWithRetry(
  adapter: IBrokerAdapter,
  request: OrderRequest,
  config: ExecutionConfig = {}
): Promise<ExecutionResult> {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    confirmTimeout = 5000,
    maxSlippagePercent = 0.1,
    latencyThreshold = 2000,
  } = config;

  let lastError: Error | null = null;
  let retries = 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const startTime = Date.now();

    try {
      // Place order
      const orderResponse = await adapter.placeOrder(request);
      const latency = Date.now() - startTime;

      // Check latency
      if (latency > latencyThreshold) {
        console.warn(`Order latency ${latency}ms exceeds threshold ${latencyThreshold}ms`);
        // Cancel order if latency too high
        try {
          await adapter.cancelOrder(orderResponse.orderId);
        } catch (cancelError) {
          console.error('Failed to cancel high-latency order:', cancelError);
        }
        
        if (attempt < maxRetries) {
          retries++;
          await sleep(retryDelay);
          continue;
        }
        
        return {
          success: false,
          error: `Order latency ${latency}ms exceeds threshold`,
          retries,
          latency,
        };
      }

      // Confirm order fill
      const confirmed = await confirmOrderFill(
        adapter,
        orderResponse.orderId,
        confirmTimeout
      );

      if (!confirmed) {
        if (attempt < maxRetries) {
          retries++;
          await sleep(retryDelay);
          continue;
        }
        
        return {
          success: false,
          error: 'Order confirmation timeout',
          retries,
          latency,
        };
      }

      // Check slippage
      const slippage = calculateSlippage(request, orderResponse);
      if (slippage > maxSlippagePercent) {
        console.warn(`Slippage ${slippage.toFixed(3)}% exceeds maximum ${maxSlippagePercent}%`);
        // For high slippage, we still return success but log warning
        // In production, you might want to cancel and retry
      }

      return {
        success: true,
        orderResponse,
        retries,
        latency,
        slippage,
      };
    } catch (error: any) {
      lastError = error;
      retries++;

      if (attempt < maxRetries) {
        console.warn(`Order execution attempt ${attempt + 1} failed:`, error.message);
        await sleep(retryDelay * (attempt + 1)); // Exponential backoff
      }
    }
  }

  return {
    success: false,
    error: lastError?.message || 'Order execution failed after retries',
    retries,
  };
}

/**
 * Confirm order fill by checking order status
 */
async function confirmOrderFill(
  adapter: IBrokerAdapter,
  orderId: string,
  timeout: number
): Promise<boolean> {
  const startTime = Date.now();
  const checkInterval = 500; // Check every 500ms

  while (Date.now() - startTime < timeout) {
    try {
      const orderStatus = await adapter.getOrderStatus(orderId);
      
      if (orderStatus.status === 'FILLED' || orderStatus.status === 'PARTIALLY_FILLED') {
        return true;
      }
      
      if (orderStatus.status === 'CANCELLED' || orderStatus.status === 'REJECTED') {
        return false;
      }

      await sleep(checkInterval);
    } catch (error) {
      // If we can't check status, assume it's processing
      await sleep(checkInterval);
    }
  }

  return false;
}

/**
 * Calculate slippage percentage
 */
function calculateSlippage(request: OrderRequest, response: OrderResponse): number {
  if (!request.price || !response.filledPrice) {
    return 0;
  }

  const slippage = Math.abs(response.filledPrice - request.price) / request.price * 100;
  return slippage;
}

/**
 * Check spread before execution
 */
export async function checkSpreadBeforeExecution(
  adapter: IBrokerAdapter,
  symbol: string,
  maxSpreadPercent: number = 0.1
): Promise<{ isValid: boolean; spreadPercent: number; reason?: string }> {
  try {
    const marketData = await adapter.getMarketData(symbol);
    const spread = marketData.ask - marketData.bid;
    const midPrice = (marketData.ask + marketData.bid) / 2;
    const spreadPercent = (spread / midPrice) * 100;

    if (spreadPercent > maxSpreadPercent) {
      return {
        isValid: false,
        spreadPercent,
        reason: `Spread ${spreadPercent.toFixed(3)}% exceeds maximum ${maxSpreadPercent}%`,
      };
    }

    return {
      isValid: true,
      spreadPercent,
    };
  } catch (error: any) {
    return {
      isValid: false,
      spreadPercent: 0,
      reason: `Failed to check spread: ${error.message}`,
    };
  }
}

/**
 * Reduce slippage for gold and indices by using limit orders near market price
 */
export function optimizeOrderForSlippage(
  request: OrderRequest,
  marketData: { bid: number; ask: number },
  symbol: string
): OrderRequest {
  // For gold and indices, use limit orders to reduce slippage
  const isGoldOrIndex = symbol.includes('XAU') || 
                       symbol.includes('US30') || 
                       symbol.includes('NAS100') ||
                       symbol.includes('SPX');

  if (isGoldOrIndex && request.type === 'MARKET') {
    // Use limit order slightly better than market price
    const limitPrice = request.side === 'BUY'
      ? marketData.ask * 1.0001 // Slightly above ask to ensure fill
      : marketData.bid * 0.9999; // Slightly below bid to ensure fill

    return {
      ...request,
      type: 'LIMIT',
      price: limitPrice,
    };
  }

  return request;
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute order with comprehensive checks
 */
export async function executeOrderSafely(
  adapter: IBrokerAdapter,
  request: OrderRequest,
  config: ExecutionConfig = {}
): Promise<ExecutionResult> {
  const {
    spreadCheck = true,
    maxSpreadPercent = 0.1,
  } = config;

  // Check spread before execution
  if (spreadCheck) {
    const spreadCheckResult = await checkSpreadBeforeExecution(
      adapter,
      request.symbol,
      maxSpreadPercent
    );

    if (!spreadCheckResult.isValid) {
      return {
        success: false,
        error: spreadCheckResult.reason || 'Spread check failed',
      };
    }
  }

  // Get current market data for slippage optimization
  try {
    const marketData = await adapter.getMarketData(request.symbol);
    const optimizedRequest = optimizeOrderForSlippage(request, marketData, request.symbol);
    
    return await executeOrderWithRetry(adapter, optimizedRequest, config);
  } catch (error: any) {
    // Fallback to original request if market data fetch fails
    return await executeOrderWithRetry(adapter, request, config);
  }
}

