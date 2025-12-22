/**
 * Exness CSV/Excel Upload API
 * COMPLIANCE: Read-only data processing - no API trading or automation
 * Processes manually uploaded trading data for diagnostics only
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { connectToDatabase } from '@/database/mongoose';
import { SignalistBotTrade } from '@/database/models/signalist-bot-trade.model';

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    const validTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    
    const isValidType = validTypes.includes(file.type) || 
                       file.name.endsWith('.csv') || 
                       file.name.endsWith('.xlsx') || 
                       file.name.endsWith('.xls');

    if (!isValidType) {
      return NextResponse.json(
        { success: false, error: 'Invalid file type. Please upload a CSV or Excel file.' },
        { status: 400 }
      );
    }

    // Read file content
    const fileContent = await file.text();
    
    // Parse CSV (basic parser - can be enhanced for Excel)
    const lines = fileContent.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      return NextResponse.json(
        { success: false, error: 'File appears to be empty or invalid' },
        { status: 400 }
      );
    }

    // Parse header row (assume standard MT4/MT5 export format)
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    
    // Find column indices
    const dateIndex = headers.findIndex(h => h.includes('time') || h.includes('date'));
    const symbolIndex = headers.findIndex(h => h.includes('symbol') || h.includes('instrument'));
    const typeIndex = headers.findIndex(h => h.includes('type') || h.includes('action'));
    const volumeIndex = headers.findIndex(h => h.includes('volume') || h.includes('lot'));
    const priceIndex = headers.findIndex(h => h.includes('price') || h.includes('open'));
    const slIndex = headers.findIndex(h => h.includes('sl') || h.includes('stop'));
    const tpIndex = headers.findIndex(h => h.includes('tp') || h.includes('take'));
    const profitIndex = headers.findIndex(h => h.includes('profit') || h.includes('pnl'));
    const swapIndex = headers.findIndex(h => h.includes('swap') || h.includes('commission'));

    if (dateIndex === -1 || symbolIndex === -1) {
      return NextResponse.json(
        { success: false, error: 'File format not recognized. Please ensure the CSV contains Time/Date and Symbol columns.' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const trades: any[] = [];
    let processedCount = 0;

    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      
      if (values.length < headers.length) continue;

      try {
        const dateStr = values[dateIndex];
        const symbol = values[symbolIndex]?.toUpperCase() || 'UNKNOWN';
        const type = values[typeIndex]?.toUpperCase() || 'BUY';
        const volume = parseFloat(values[volumeIndex] || '0');
        const openPrice = parseFloat(values[priceIndex] || '0');
        const profit = parseFloat(values[profitIndex] || '0');
        const swap = parseFloat(values[swapIndex] || '0');
        const totalPnl = profit + swap;

        // Determine side
        const side = type.includes('BUY') || type === '0' ? 'BUY' : 'SELL';

        // Parse date (handle various formats)
        let entryDate: Date;
        try {
          entryDate = new Date(dateStr);
          if (isNaN(entryDate.getTime())) {
            // Try alternative formats
            entryDate = new Date(dateStr.replace(/\s+/g, ' '));
          }
        } catch {
          continue; // Skip invalid rows
        }

        // Determine if trade is open or closed
        const isClosed = totalPnl !== 0 || values.some(v => v.includes('CLOSED') || v.includes('CLOSE'));

        // Create trade record
        const trade = {
          userId,
          broker: 'exness',
          tradeId: `exness-${userId}-${Date.now()}-${i}`,
          symbol,
          side,
          entryPrice: openPrice,
          exitPrice: isClosed ? (openPrice + (totalPnl / volume)) : openPrice,
          lotOrStake: volume,
          realizedPnl: isClosed ? totalPnl : 0,
          unrealizedPnl: isClosed ? 0 : totalPnl,
          status: isClosed ? 'CLOSED' : 'OPEN',
          entryTimestamp: entryDate,
          exitTimestamp: isClosed ? entryDate : null,
          brokerTradeId: `exness-${i}`,
          source: 'csv_upload',
        };

        trades.push(trade);
        processedCount++;
      } catch (error) {
        console.warn(`[Exness Upload] Error parsing row ${i}:`, error);
        continue;
      }
    }

    if (trades.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid trades found in file' },
        { status: 400 }
      );
    }

    // Save trades to database (upsert to avoid duplicates)
    const savedTrades = [];
    for (const trade of trades) {
      try {
        await SignalistBotTrade.findOneAndUpdate(
          { userId, broker: 'exness', brokerTradeId: trade.brokerTradeId },
          trade,
          { upsert: true, new: true }
        );
        savedTrades.push(trade);
      } catch (error) {
        console.error(`[Exness Upload] Error saving trade:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully imported ${savedTrades.length} trades from ${file.name}`,
      data: {
        tradesCount: savedTrades.length,
        fileName: file.name,
        uploadedAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('[Exness Upload API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to process file' },
      { status: 500 }
    );
  }
}

