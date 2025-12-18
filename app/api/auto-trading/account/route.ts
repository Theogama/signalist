/**
 * Demo Account API
 * GET: Get demo account balance and stats
 * POST: Reset demo account
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { DemoAccount } from '@/database/models/demo-account.model';
import { connectToDatabase } from '@/database/mongoose';
import { PaperTrader } from '@/lib/auto-trading/paper-trader/PaperTrader';
import { botManager } from '@/lib/services/bot-manager.service';
import { sessionManager } from '@/lib/auto-trading/session-manager/SessionManager';

const MT5_SERVICE_URL = process.env.MT5_SERVICE_URL || 'http://localhost:5000';

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await connectToDatabase();

    const broker = request.nextUrl.searchParams.get('broker') || 'demo';
    const brokerType = broker as 'exness' | 'deriv' | 'demo';

    // For Deriv, check if there's an adapter connection
    if (brokerType === 'deriv') {
      const adapter = sessionManager.getUserAdapter(session.user.id, 'deriv');
      
      if (adapter) {
        try {
          // Try to get balance from adapter
          const balance = await adapter.getBalance();
          
          // Get account stats from database
          const account = await DemoAccount.findOne({ 
            userId: session.user.id, 
            broker: brokerType 
          });

          return NextResponse.json({
            success: true,
            data: {
              balance: balance.balance,
              equity: balance.equity,
              margin: balance.margin,
              freeMargin: balance.freeMargin,
              currency: balance.currency || 'USD',
              marginLevel: balance.marginLevel || 0,
              initialBalance: account?.initialBalance || 10000,
              totalProfitLoss: account?.totalProfitLoss || 0,
              totalTrades: account?.totalTrades || 0,
              winningTrades: account?.winningTrades || 0,
              losingTrades: account?.losingTrades || 0,
            },
          });
        } catch (error: any) {
          console.error('Error fetching Deriv account from adapter:', error);
          // Fall through to PaperTrader/database fallback
        }
      }
      // If no adapter or error, fall through to PaperTrader/database logic below
    }

    // For Exness, check if there's an MT5 connection
    if (brokerType === 'exness') {
      const adapter = sessionManager.getUserAdapter(session.user.id, 'exness');
      
      if (adapter && (adapter as any).connectionId) {
        // Fetch from MT5 service
        try {
          const mt5Response = await fetch(
            `${MT5_SERVICE_URL}/account?connection_id=${(adapter as any).connectionId}`
          );
          
          if (mt5Response.ok) {
            const mt5Data = await mt5Response.json();
            if (mt5Data.success && mt5Data.account) {
              return NextResponse.json({
                success: true,
                data: {
                  balance: mt5Data.account.balance || 0,
                  equity: mt5Data.account.equity || 0,
                  margin: mt5Data.account.margin || 0,
                  freeMargin: mt5Data.account.free_margin || 0,
                  currency: mt5Data.account.currency || 'USD',
                  marginLevel: mt5Data.account.margin_level || 0,
                },
              });
            }
          }
        } catch (error) {
          console.error('Error fetching MT5 account:', error);
          return NextResponse.json(
            { success: false, error: 'Failed to fetch Exness account. Please ensure you are connected with valid MT5 credentials.' },
            { status: 500 }
          );
        }
      } else {
        // No MT5 connection found
        return NextResponse.json(
          { success: false, error: 'Exness requires MT5 connection. Please connect with your MT5 login credentials.' },
          { status: 400 }
        );
      }
    }

    // For Deriv and demo, use PaperTrader or database
    // Try to get balance from active PaperTrader (if bot is running)
    const userBots = botManager.getUserBots(session.user.id);
    let balanceData = null;

    // Check if there's an active bot with PaperTrader for this broker
    // Prioritize bot that matches the requested broker
    for (const bot of userBots) {
      if (bot.paperTrader && bot.isRunning) {
        // Get balance from PaperTrader (this recalculates equity with latest prices)
        // PaperTrader recalculates equity on getBalance() call
        balanceData = bot.paperTrader.getBalance();
        // If broker matches, use this one; otherwise continue to find matching broker
        if (bot.broker === brokerType || brokerType === 'demo') {
          break;
        }
      }
    }
    
    // If no running bot found, try to find any bot with PaperTrader (even if not running)
    if (!balanceData) {
      for (const bot of userBots) {
        if (bot.paperTrader) {
          balanceData = bot.paperTrader.getBalance();
          if (bot.broker === brokerType || brokerType === 'demo') {
            break;
          }
        }
      }
    }

    // If no active PaperTrader, try to get from database or create new PaperTrader instance
    if (!balanceData) {
      try {
        const account = await DemoAccount.findOne({ 
          userId: session.user.id, 
          broker: brokerType 
        });

        if (account) {
          // Create PaperTrader instance to get properly calculated balance
          try {
            const trader = new PaperTrader(session.user.id, brokerType, account.initialBalance);
            await trader.initialize();
            balanceData = trader.getBalance();
          } catch (traderError) {
            console.error('Error initializing PaperTrader:', traderError);
            // Fallback to database values
            balanceData = {
              balance: account.balance,
              equity: account.equity,
              margin: account.margin,
              freeMargin: account.freeMargin,
              currency: account.currency || 'USD',
            };
          }
        } else {
          // Create default account if doesn't exist (use upsert to handle duplicates)
          try {
            // Use findOneAndUpdate with upsert to atomically create or get existing account
            const newAccount = await DemoAccount.findOneAndUpdate(
              { userId: session.user.id, broker: brokerType },
              {
                $setOnInsert: {
                  balance: 10000,
                  equity: 10000,
                  margin: 0,
                  freeMargin: 10000,
                  initialBalance: 10000,
                  currency: 'USD',
                  totalProfitLoss: 0,
                  totalTrades: 0,
                  winningTrades: 0,
                  losingTrades: 0,
                },
              },
              {
                upsert: true,
                new: true,
                setDefaultsOnInsert: true,
                runValidators: false, // Skip validation to avoid issues
              }
            );

            if (newAccount) {
              balanceData = {
                balance: newAccount.balance,
                equity: newAccount.equity,
                margin: newAccount.margin,
                freeMargin: newAccount.freeMargin,
                currency: newAccount.currency,
              };
            } else {
              // If upsert didn't return a document, try to find it (race condition handling)
              const foundAccount = await DemoAccount.findOne({ 
                userId: session.user.id, 
                broker: brokerType 
              }).lean();
              
              if (foundAccount) {
                balanceData = {
                  balance: foundAccount.balance,
                  equity: foundAccount.equity,
                  margin: foundAccount.margin,
                  freeMargin: foundAccount.freeMargin,
                  currency: foundAccount.currency,
                };
              } else {
                // Fallback to default values
                balanceData = {
                  balance: 10000,
                  equity: 10000,
                  margin: 0,
                  freeMargin: 10000,
                  currency: 'USD',
                };
              }
            }
          } catch (createError: any) {
            // Handle any errors (including duplicate key) by trying to load existing account
            console.error('Error creating/updating demo account:', createError);
            
            try {
              const existingAccount = await DemoAccount.findOne({ 
                userId: session.user.id, 
                broker: brokerType 
              }).lean();
              
              if (existingAccount) {
                balanceData = {
                  balance: existingAccount.balance,
                  equity: existingAccount.equity,
                  margin: existingAccount.margin,
                  freeMargin: existingAccount.freeMargin,
                  currency: existingAccount.currency,
                };
              } else {
                // Fallback to default values if account doesn't exist
                balanceData = {
                  balance: 10000,
                  equity: 10000,
                  margin: 0,
                  freeMargin: 10000,
                  currency: 'USD',
                };
              }
            } catch (loadError: any) {
              // If loading also fails, use default values
              console.error('Error loading existing account:', loadError);
              balanceData = {
                balance: 10000,
                equity: 10000,
                margin: 0,
                freeMargin: 10000,
                currency: 'USD',
              };
            }
          }
        }
      } catch (dbError) {
        console.error('Database error in account API:', dbError);
        // Fallback to default values if database fails
        balanceData = {
          balance: 10000,
          equity: 10000,
          margin: 0,
          freeMargin: 10000,
          currency: 'USD',
        };
      }
    }

    // Get account stats from database
    const account = await DemoAccount.findOne({ 
      userId: session.user.id, 
      broker: brokerType 
    });

    return NextResponse.json({
      success: true,
      data: {
        balance: balanceData.balance,
        equity: balanceData.equity,
        margin: balanceData.margin,
        freeMargin: balanceData.freeMargin,
        currency: balanceData.currency || 'USD',
        marginLevel: balanceData.marginLevel,
        initialBalance: account?.initialBalance || 10000,
        totalProfitLoss: account?.totalProfitLoss || 0,
        totalTrades: account?.totalTrades || 0,
        winningTrades: account?.winningTrades || 0,
        losingTrades: account?.losingTrades || 0,
      },
    });
  } catch (error: any) {
    console.error('Error fetching demo account:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch account' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { action, initialBalance, broker } = body;

    await connectToDatabase();

    const brokerType = (broker || 'demo') as 'exness' | 'deriv' | 'demo';
    const balance = initialBalance || 10000;

    if (action === 'reset') {
      const account = await DemoAccount.findOneAndUpdate(
        { userId: session.user.id, broker: brokerType },
        {
          balance,
          equity: balance,
          margin: 0,
          freeMargin: balance,
          initialBalance: balance,
          totalProfitLoss: 0,
          totalTrades: 0,
          winningTrades: 0,
          losingTrades: 0,
        },
        { upsert: true, new: true }
      );

      return NextResponse.json({
        success: true,
        message: 'Demo account reset successfully',
        data: {
          balance: account.balance,
          equity: account.equity,
          margin: account.margin,
          freeMargin: account.freeMargin,
        },
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Error resetting demo account:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to reset account' },
      { status: 500 }
    );
  }
}

