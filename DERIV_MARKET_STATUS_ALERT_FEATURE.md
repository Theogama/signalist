# Deriv Market Status Alert Feature

## Overview
Real-time market status monitoring with toast notifications when the Deriv market opens or closes, similar to the Deriv platform's market status alerts.

## Features

### 1. Real-Time Monitoring
- Monitors market status every 30 seconds
- Checks status for the selected trading instrument
- Automatically starts/stops based on broker connection

### 2. Toast Notifications
- **Market Opens**: Green success toast when market becomes open
- **Market Closes**: Red warning toast when market becomes closed
- **Market Suspended**: Yellow error toast when market is suspended
- Only shows notifications when status actually changes (not on every check)

### 3. Visual Status Indicator
- Badge showing current market status (OPEN/CLOSED/SUSPENDED)
- Color-coded status (green for open, red for closed, yellow for suspended)
- Shows current symbol being monitored
- Pulsing indicator when actively monitoring

### 4. Alert Controls
- Toggle button to enable/disable notifications
- Visual indicator (bell icon) showing alert state
- Alerts are enabled by default

## Component

**File**: `components/deriv/DerivMarketStatusAlert.tsx`

### Integration
The component is integrated into `AutoTradingDashboard.tsx` and only shows when Deriv broker is connected.

```tsx
{connectedBroker === 'deriv' && (
  <>
    {/* Deriv Market Status Alert */}
    <DerivMarketStatusAlert />
    {/* ... other components ... */}
  </>
)}
```

### Props
None - uses `useAutoTradingStore` to get:
- `connectedBroker`: To determine if Deriv is connected
- `selectedInstrument`: To get the symbol to monitor

### Behavior
1. **Auto-start**: Automatically starts monitoring when Deriv is connected
2. **Symbol Selection**: Uses selected instrument symbol, defaults to 'BOOM500'
3. **Status Checks**: Polls `/api/deriv/market-status` every 30 seconds
4. **Change Detection**: Only shows toast notifications when status actually changes
5. **Cleanup**: Automatically stops monitoring when Deriv disconnects

## API Endpoint

**Endpoint**: `GET /api/deriv/market-status?symbol=BOOM500`

**Response**:
```json
{
  "success": true,
  "isOpen": true,
  "status": "open",
  "symbol": "BOOM500",
  "isTradable": true,
  "reason": null,
  "nextOpen": null,
  "checkedAt": "2024-01-01T12:00:00.000Z",
  "source": "api"
}
```

## Status Types

- **OPEN**: Market is open and tradable (green)
- **CLOSED**: Market is closed (red)
- **SUSPENDED**: Market is temporarily suspended (yellow)
- **UNKNOWN**: Status cannot be determined (gray)

## Usage

1. **Automatic**: Component automatically appears when Deriv is connected
2. **Monitoring**: Starts monitoring immediately upon mount
3. **Notifications**: Shows toast alerts when market status changes
4. **Control**: Click bell icon to toggle notifications on/off

## Example Toast Notifications

### Market Opens
```
🟢 Market is now OPEN
BOOM500 market is now open for trading
```

### Market Closes
```
🔴 Market is now CLOSED
BOOM500 market is now closed
```

### Market Suspended
```
⏸️ Market Suspended
BOOM500 market is temporarily suspended
```

## Technical Details

### Polling Interval
- Checks market status every **30 seconds**
- Initial check on component mount
- Stops polling when component unmounts or broker disconnects

### Change Detection
- Compares current status with previous status
- Only triggers toast notification if:
  - `isOpen` value changes (open ↔ closed)
  - `status` type changes (e.g., open → suspended)

### Performance
- Lightweight polling (30-second interval)
- Uses existing market status API endpoint
- No additional WebSocket connections
- Automatically cleans up intervals on unmount

## Future Enhancements

Potential improvements:
1. Use WebSocket for real-time updates (no polling)
2. Support multiple symbols simultaneously
3. Sound alerts option
4. Customizable notification settings
5. Notification history log

## Testing

To test the feature:
1. Connect Deriv broker
2. Select a trading instrument
3. Wait for initial status check (immediate)
4. Toggle alerts on/off using bell icon
5. Monitor toast notifications when market status changes

The component will automatically:
- Start monitoring when Deriv connects
- Stop monitoring when Deriv disconnects
- Update status indicator in real-time
- Show notifications only on status changes

