# Automation Enhancements

## Overview
Enhanced the auto-trading system with comprehensive automation features including scheduling, auto-start/stop conditions, error recovery, and performance-based adjustments.

## ✅ Completed Features

### 1. Automation Manager Service
**File**: `lib/auto-trading/automation/AutomationManager.ts`

A centralized service that manages all automation rules and their execution:

- **Rule Types**:
  - `schedule`: Time-based automation (start/stop at specific times)
  - `profit_target`: Auto-stop when profit target is reached
  - `loss_limit`: Auto-stop when loss limit is reached
  - `time_limit`: Auto-stop after maximum runtime
  - `recovery`: Auto-recovery from errors

- **Features**:
  - Register and manage multiple automation rules per bot
  - Enable/disable rules dynamically
  - Schedule-based trading sessions with day-of-week support
  - Real-time monitoring of profit/loss conditions
  - Automatic error tracking and recovery
  - Cleanup on bot/user removal

### 2. Automation Panel UI
**File**: `components/autotrade/AutomationPanel.tsx`

A comprehensive UI component for configuring automation rules:

- **Rule Configuration**:
  - Add new automation rules with different types
  - Configure conditions (time, profit, loss, errors)
  - Enable/disable rules with toggle switch
  - Delete rules
  - Visual rule cards with icons and descriptions

- **Rule Types UI**:
  - **Schedule**: Start/end time pickers
  - **Profit Target**: USD amount or percentage
  - **Loss Limit**: USD amount or percentage
  - **Time Limit**: Maximum runtime in minutes
  - **Recovery**: Max errors, cooldown, auto-restart toggle

### 3. API Endpoints
**Files**: 
- `app/api/auto-trading/automation/rules/route.ts`
- `app/api/auto-trading/automation/rules/[ruleId]/route.ts`
- `app/api/auto-trading/automation/rules/[ruleId]/toggle/route.ts`

RESTful API for managing automation rules:
- `GET /api/auto-trading/automation/rules?botId=xxx` - List rules
- `POST /api/auto-trading/automation/rules` - Create rule
- `DELETE /api/auto-trading/automation/rules/[ruleId]` - Delete rule
- `POST /api/auto-trading/automation/rules/[ruleId]/toggle` - Enable/disable rule

### 4. Error Recovery Integration
**File**: `lib/services/bot-manager.service.ts`

Integrated automation manager with bot manager for error handling:

- Automatic error tracking per bot
- Error count monitoring
- Auto-restart after cooldown period
- Auto-stop on too many errors
- Error count reset on successful operations

## How It Works

### Schedule-Based Automation
1. User configures start/end times and days of week
2. AutomationManager calculates next execution time
3. Bot automatically starts at scheduled time
4. Bot automatically stops at end time

### Profit/Loss Automation
1. User sets profit target or loss limit (USD or %)
2. AutomationManager monitors bot performance every 10 seconds
3. When condition is met, bot automatically stops
4. Notification is sent (if configured)

### Time Limit Automation
1. User sets maximum runtime in minutes
2. AutomationManager tracks bot uptime
3. Bot automatically stops when time limit is reached

### Error Recovery
1. Bot errors are automatically tracked
2. When error count reaches threshold:
   - If auto-restart enabled: Wait for cooldown, then restart
   - If auto-restart disabled: Stop bot permanently
3. Error count resets on successful operations

## Usage Example

### Creating a Schedule Rule
```typescript
{
  type: 'schedule',
  enabled: true,
  conditions: {
    startTime: '09:00',
    endTime: '17:00',
    daysOfWeek: [1, 2, 3, 4, 5] // Monday-Friday
  },
  actions: {
    startBot: true,
    stopBot: true,
    notify: true
  }
}
```

### Creating a Profit Target Rule
```typescript
{
  type: 'profit_target',
  enabled: true,
  conditions: {
    profitPercent: 10 // Stop at 10% profit
  },
  actions: {
    stopBot: true,
    notify: true
  }
}
```

### Creating a Recovery Rule
```typescript
{
  type: 'recovery',
  enabled: true,
  conditions: {
    maxErrors: 5,
    errorCooldown: 60, // seconds
    autoRestart: true
  },
  actions: {
    notify: true
  }
}
```

## Integration Points

### Bot Manager
- Error handling calls `automationManager.handleError()`
- Successful operations call `automationManager.resetErrorCount()`
- Rules are checked during bot execution

### Dashboard
- AutomationPanel component added to AutoTradingDashboard
- Accessible after selecting a bot
- Real-time rule status display

## Benefits

1. **Hands-Free Operation**: Bots can run automatically based on schedules
2. **Risk Management**: Auto-stop on profit/loss targets prevents over-trading
3. **Error Resilience**: Automatic recovery from temporary errors
4. **Time Management**: Prevent bots from running indefinitely
5. **Flexibility**: Multiple rules can be combined for complex automation

## Future Enhancements

- Performance-based risk adjustment (auto-increase/decrease risk based on win rate)
- Multi-bot coordination (start/stop multiple bots together)
- Advanced scheduling (timezone support, market hours detection)
- Email/push notification integration
- Rule templates and presets
- Backtesting automation rules

## Testing

To test automation:
1. Select a bot in the dashboard
2. Go to Automation panel
3. Add a schedule rule (e.g., start at 09:00, stop at 17:00)
4. Enable the rule
5. Bot will automatically start/stop at scheduled times

To test error recovery:
1. Add a recovery rule with maxErrors: 3, autoRestart: true
2. Simulate errors (or wait for real errors)
3. After 3 errors, bot will restart after cooldown period







