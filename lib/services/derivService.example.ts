/**
 * DerivService Usage Examples
 * 
 * This file demonstrates how to use the DerivService class
 * for various Deriv API operations.
 */

import DerivService, { getDerivService } from './derivService';

// ============================================================================
// Example 1: Basic Setup and Authorization
// ============================================================================

async function example1_BasicSetup() {
  // Get token from environment variable (server-side only)
  const token = process.env.DERIV_API_TOKEN;
  
  if (!token) {
    throw new Error('DERIV_API_TOKEN environment variable is required');
  }

  // Create service instance
  const deriv = new DerivService(token);

  // Connect and authorize
  await deriv.connect();

  // Check connection status
  console.log('Connected:', deriv.isConnected());
  console.log('Authenticated:', deriv.isAuthenticated());

  // Get account info
  const accountInfo = deriv.getAccountInfo();
  console.log('Account Info:', accountInfo);

  // Clean up
  await deriv.disconnect();
}

// ============================================================================
// Example 2: Get Balance
// ============================================================================

async function example2_GetBalance() {
  const deriv = new DerivService(process.env.DERIV_API_TOKEN!);
  
  try {
    await deriv.connect();
    
    const balance = await deriv.getBalance();
    console.log(`Balance: ${balance.balance} ${balance.currency}`);
  } catch (error) {
    console.error('Error getting balance:', error);
  } finally {
    await deriv.disconnect();
  }
}

// ============================================================================
// Example 3: Get Proposal
// ============================================================================

async function example3_GetProposal() {
  const deriv = new DerivService(process.env.DERIV_API_TOKEN!);
  
  try {
    await deriv.connect();
    
    // Get proposal for a RISE contract on BOOM1000
    const proposal = await deriv.getProposal({
      proposal: 1,
      amount: 10, // $10 stake
      contract_type: 'RISE',
      symbol: 'BOOM1000',
      duration: 5,
      duration_unit: 't', // ticks
      basis: 'stake',
    });

    console.log('Proposal:', {
      id: proposal.id,
      askPrice: proposal.ask_price,
      payout: proposal.payout,
      spot: proposal.spot,
    });
  } catch (error) {
    console.error('Error getting proposal:', error);
  } finally {
    await deriv.disconnect();
  }
}

// ============================================================================
// Example 4: Buy Contract
// ============================================================================

async function example4_BuyContract() {
  const deriv = new DerivService(process.env.DERIV_API_TOKEN!);
  
  try {
    await deriv.connect();
    
    // First, get a proposal
    const proposal = await deriv.getProposal({
      proposal: 1,
      amount: 10,
      contract_type: 'RISE',
      symbol: 'BOOM1000',
      duration: 5,
      duration_unit: 't',
      basis: 'stake',
    });

    // Buy using the proposal ID
    const buyResult = await deriv.buy({
      buy: proposal.id, // Use proposal ID
      price: 10, // Stake amount
    });

    console.log('Contract bought:', {
      contractId: buyResult.contract_id,
      purchasePrice: buyResult.purchase_time,
      buyPrice: buyResult.buy_price,
    });

    // Or buy directly without proposal
    const directBuy = await deriv.buy({
      buy: 1, // Direct buy
      price: 10,
      parameters: {
        contract_type: 'RISE',
        symbol: 'BOOM1000',
        duration: 5,
        duration_unit: 't',
        basis: 'stake',
      },
    });

    console.log('Direct buy result:', directBuy);
  } catch (error) {
    console.error('Error buying contract:', error);
  } finally {
    await deriv.disconnect();
  }
}

// ============================================================================
// Example 5: Get Transaction History
// ============================================================================

async function example5_TransactionHistory() {
  const deriv = new DerivService(process.env.DERIV_API_TOKEN!);
  
  try {
    await deriv.connect();
    
    // Get last 50 transactions
    const transactions = await deriv.getTransactionHistory({
      limit: 50,
      offset: 0,
    });

    console.log(`Found ${transactions.length} transactions:`);
    transactions.forEach((tx) => {
      console.log({
        id: tx.transaction_id,
        contractId: tx.contract_id,
        symbol: tx.symbol,
        action: tx.action,
        amount: tx.amount,
        balanceAfter: tx.balance_after,
        time: new Date(tx.transaction_time * 1000).toISOString(),
      });
    });

    // Get buy transactions only
    const buyTransactions = await deriv.getTransactionHistory({
      limit: 20,
      action: 'buy',
    });

    console.log(`Found ${buyTransactions.length} buy transactions`);
  } catch (error) {
    console.error('Error getting transaction history:', error);
  } finally {
    await deriv.disconnect();
  }
}

// ============================================================================
// Example 6: Event Listeners
// ============================================================================

async function example6_EventListeners() {
  const deriv = new DerivService(process.env.DERIV_API_TOKEN!);
  
  // Listen for authorization
  deriv.on('authorized', (accountInfo) => {
    console.log('Authorized:', accountInfo);
  });

  // Listen for contract updates
  deriv.on('contract_update', (contract) => {
    console.log('Contract updated:', contract);
  });

  // Listen for errors
  deriv.on('error', (error) => {
    console.error('Service error:', error);
  });

  // Listen for reconnection failures
  deriv.on('reconnect_failed', (error) => {
    console.error('Reconnection failed:', error);
  });

  await deriv.connect();
  
  // Keep connection alive for event listening
  // In production, you'd want to handle this properly
  // setTimeout(() => deriv.disconnect(), 60000);
}

// ============================================================================
// Example 7: Using Singleton Pattern
// ============================================================================

async function example7_Singleton() {
  // Get default instance (uses DERIV_API_TOKEN from env)
  const deriv = getDerivService();
  
  // Or create with specific token
  const deriv2 = getDerivService('your-token-here');
  
  await deriv.connect();
  const balance = await deriv.getBalance();
  console.log('Balance:', balance);
}

// ============================================================================
// Example 8: Error Handling
// ============================================================================

async function example8_ErrorHandling() {
  const deriv = new DerivService(process.env.DERIV_API_TOKEN!);
  
  try {
    await deriv.connect();
    
    // Try to get balance (will throw if not authenticated)
    try {
      const balance = await deriv.getBalance();
      console.log('Balance:', balance);
    } catch (error: any) {
      if (error.message.includes('Not authenticated')) {
        // Re-authorize
        await deriv.authorize(process.env.DERIV_API_TOKEN!);
        const balance = await deriv.getBalance();
        console.log('Balance after re-auth:', balance);
      } else {
        throw error;
      }
    }
  } catch (error: any) {
    // Handle connection errors
    if (error.message.includes('timeout')) {
      console.error('Connection timeout - check network');
    } else if (error.message.includes('Authorization failed')) {
      console.error('Invalid API token');
    } else {
      console.error('Unexpected error:', error);
    }
  } finally {
    await deriv.disconnect();
  }
}

// Export for use in other files
export {
  example1_BasicSetup,
  example2_GetBalance,
  example3_GetProposal,
  example4_BuyContract,
  example5_TransactionHistory,
  example6_EventListeners,
  example7_Singleton,
  example8_ErrorHandling,
};

