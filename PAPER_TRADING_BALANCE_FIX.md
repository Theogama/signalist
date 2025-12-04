# Paper Trading Balance Calculation Fix

## Issues Fixed

### 1. **Derivative P&L Calculation**
**Problem**: For Boom/Crash derivatives, P&L was calculated incorrectly using price difference × quantity, but for derivatives:
- `quantity` = stake amount (in currency, e.g., $10)
- P&L should be: `stake × (multiplier - 1)` where multiplier = `exitPrice / entryPrice`

**Fix**: Updated `calculatePnl()` to detect derivatives and use multiplier-based calculation.

### 2. **Position Size for Derivatives**
**Problem**: Position size calculation was returning very small values for derivatives (like 0.001) because it divided risk by price difference.

**Fix**: For derivatives, position size now represents stake amount directly:
- `positionSize = (balance × riskPercent) / 100`
- Minimum stake: $1

### 3. **Margin Calculation**
**Problem**: Margin was calculated the same for all instruments.

**Fix**: 
- **Derivatives**: Full stake amount is required as margin
- **Regular instruments**: 10% of position value

### 4. **Balance Updates**
**Problem**: Balance wasn't updating visibly in the frontend.

**Fix**:
- Added balance update logging after each trade
- Live updates stream now gets fresh balance from PaperTrader
- Account API uses active PaperTrader instance for real-time balance

### 5. **Equity Calculation**
**Problem**: Equity wasn't including unrealized P&L properly.

**Fix**: 
- `Equity = Balance + Unrealized P&L`
- Recalculated after every position update
- Ensures equity ≥ margin (no negative free margin)

## How It Works Now

### Opening a Trade:
1. **Calculate stake/position size** based on risk %
2. **Lock margin** (full stake for derivatives, 10% for regular)
3. **Balance stays same** (margin is locked, not deducted)
4. **Equity = Balance** (no unrealized P&L yet)

### While Position is Open:
1. **Unrealized P&L** calculated from current price
2. **Equity = Balance + Unrealized P&L**
3. **Free Margin = Equity - Margin**

### Closing a Trade:
1. **Calculate P&L** using correct formula for instrument type
2. **Update Balance**: `Balance += P&L`
3. **Release Margin**: Unlock the locked margin
4. **Recalculate Equity**: `Equity = Balance` (no open positions)

## Example Calculations

### Derivative (Boom 1000):
- **Balance**: $10,000
- **Risk**: 1% = $100 stake
- **Entry Price**: 10,000
- **Exit Price**: 10,200 (2% gain)
- **P&L**: $100 × (10,200/10,000 - 1) = $100 × 0.02 = **$2 profit**
- **New Balance**: $10,002
- **Margin Used**: $100 (released on close)

### Regular Instrument (XAUUSD):
- **Balance**: $10,000
- **Risk**: 1% = $100 risk
- **Entry Price**: $2,000
- **Stop Loss**: $1,980 (1% below)
- **Position Size**: $100 / ($2,000 - $1,980) = 5 units
- **Exit Price**: $2,040 (2% gain)
- **P&L**: ($2,040 - $2,000) × 5 = **$200 profit**
- **New Balance**: $10,200
- **Margin Used**: $2,000 × 5 × 0.1 = $1,000 (released on close)

## Testing

To verify the fix:
1. Start a bot with 1% risk
2. Open a trade
3. Check that:
   - Margin increases (locked funds)
   - Balance stays same (until trade closes)
   - Equity updates with unrealized P&L
   - Free Margin = Equity - Margin
4. Close the trade
5. Verify:
   - Balance updates with P&L
   - Margin is released
   - Equity = Balance (no open positions)

## Files Modified

- `lib/auto-trading/paper-trader/PaperTrader.ts` - Fixed P&L calculation, margin handling
- `lib/services/bot-manager.service.ts` - Fixed position size for derivatives, added balance logging
- `app/api/auto-trading/account/route.ts` - Uses active PaperTrader for real-time balance
- `app/api/auto-trading/live-updates/route.ts` - Gets fresh balance from PaperTrader



