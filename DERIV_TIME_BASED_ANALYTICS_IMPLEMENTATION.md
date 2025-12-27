# Deriv Time-Based Analytics Implementation

## 🎯 Overview

Complete implementation of hourly, daily, and weekly profit analytics for Deriv auto-trading. Provides comprehensive time-based performance analysis.

---

## ✅ IMPLEMENTED FEATURES

### 1. Analytics Service Methods ✅

**File**: `lib/services/bot-analytics.service.ts`

**New Methods**:
- `getHourlyPerformance()` - Aggregates profits by hour
- `getWeeklyPerformance()` - Aggregates profits by week with daily breakdown
- Helper methods: `getISOWeek()`, `getWeekStart()`, `getWeekEnd()`

**Features**:
- ✅ Hourly aggregation (last 24 hours by default)
- ✅ Daily aggregation (last 30 days by default)
- ✅ Weekly aggregation (last 12 weeks by default)
- ✅ Daily breakdown within weekly view
- ✅ Demo/Live mode filtering
- ✅ Custom date range support
- ✅ Win rate calculations
- ✅ Total stake tracking

---

### 2. API Endpoint ✅

**File**: `app/api/auto-trading/analytics/time-based/route.ts`

**Endpoint**: `GET /api/auto-trading/analytics/time-based`

**Query Parameters**:
- `botId` - Bot ID (required)
- `period` - `hourly`, `daily`, or `weekly` (default: `daily`)
- `isDemo` - `true` or `false` (default: `false`)
- `hours` - Number of hours for hourly view (default: 24)
- `days` - Number of days for daily view (default: 30)
- `weeks` - Number of weeks for weekly view (default: 12)
- `startDate` - Optional start date (ISO string)
- `endDate` - Optional end date (ISO string)

**Response**:
```json
{
  "success": true,
  "period": "daily",
  "data": [...],
  "summary": {
    "totalTrades": 100,
    "totalWins": 60,
    "totalLosses": 40,
    "totalProfitLoss": 1500.50,
    "totalStake": 10000,
    "averageWinRate": 60.0
  },
  "filters": {...}
}
```

---

### 3. UI Component ✅

**File**: `components/autotrade/TimeBasedAnalytics.tsx`

**Features**:
- ✅ Tabbed interface (Hourly, Daily, Weekly)
- ✅ Summary statistics cards
- ✅ Demo/Live toggle
- ✅ Refresh button
- ✅ Color-coded profit/loss
- ✅ Win rate badges
- ✅ Daily breakdown in weekly view
- ✅ Responsive design
- ✅ Auto-refresh on bot selection change

**Display**:
- Total P/L summary
- Total trades count
- Average win rate
- Wins/Losses ratio
- Time-based profit breakdown
- Trade counts per period
- Win rate per period

---

## 📊 DATA STRUCTURES

### Hourly Performance
```typescript
interface HourlyPerformance {
  hour: string;           // "YYYY-MM-DD HH:00"
  date: string;           // "YYYY-MM-DD"
  hourOfDay: number;      // 0-23
  trades: number;
  wins: number;
  losses: number;
  profitLoss: number;
  winRate: number;
  totalStake: number;
}
```

### Daily Performance
```typescript
interface DailyPerformance {
  date: string;           // "YYYY-MM-DD"
  trades: number;
  wins: number;
  losses: number;
  profitLoss: number;
  winRate: number;
  totalStake: number;
}
```

### Weekly Performance
```typescript
interface WeeklyPerformance {
  week: string;           // "YYYY-WW"
  weekStart: string;       // "YYYY-MM-DD"
  weekEnd: string;         // "YYYY-MM-DD"
  trades: number;
  wins: number;
  losses: number;
  profitLoss: number;
  winRate: number;
  totalStake: number;
  dailyBreakdown: DailyPerformance[];
}
```

---

## 🔧 USAGE

### API Usage

```typescript
// Get hourly analytics
const response = await fetch(
  '/api/auto-trading/analytics/time-based?botId=bot123&period=hourly&hours=24'
);

// Get daily analytics
const response = await fetch(
  '/api/auto-trading/analytics/time-based?botId=bot123&period=daily&days=30'
);

// Get weekly analytics
const response = await fetch(
  '/api/auto-trading/analytics/time-based?botId=bot123&period=weekly&weeks=12'
);

// With date range
const response = await fetch(
  '/api/auto-trading/analytics/time-based?botId=bot123&period=daily&startDate=2024-01-01&endDate=2024-01-31'
);
```

### Component Usage

```tsx
import TimeBasedAnalytics from '@/components/autotrade/TimeBasedAnalytics';

<TimeBasedAnalytics />
```

The component automatically:
- Detects selected bot
- Filters by broker (Deriv only)
- Toggles between Demo/Live
- Refreshes on bot selection change

---

## 📈 INTEGRATION

### Dashboard Integration

The component is integrated into `AutoTradingDashboard.tsx`:

```tsx
{/* Time-Based Analytics */}
<TimeBasedAnalytics />
```

Located in the right column alongside:
- Bot Diagnostics
- Universal Metrics
- P/L Tracker

---

## 🎨 UI FEATURES

1. **Summary Cards**:
   - Total P/L (color-coded)
   - Total Trades
   - Win Rate
   - Wins/Losses

2. **Tabbed Views**:
   - Hourly: Last 24 hours
   - Daily: Last 30 days
   - Weekly: Last 12 weeks with daily breakdown

3. **Interactive Elements**:
   - Demo/Live toggle
   - Refresh button
   - Hover effects
   - Scrollable lists

4. **Visual Indicators**:
   - Green for profits
   - Red for losses
   - Badges for win rates
   - Trade counts

---

## 🔍 QUERY OPTIMIZATION

- Uses indexed queries on `exitTimestamp`
- Filters by `botId` and `userId` for efficiency
- Groups trades in memory for aggregation
- Sorts results chronologically
- Limits date ranges to prevent large queries

---

## ✅ TESTING

1. **Start a bot** with Deriv broker
2. **Execute some trades**
3. **Navigate to auto-trade page**
4. **View Time-Based Analytics** component
5. **Switch between Hourly/Daily/Weekly** tabs
6. **Toggle Demo/Live** mode
7. **Verify data accuracy**

---

## 📝 NOTES

- Analytics only work for Deriv broker
- Requires closed trades (status: CLOSED, TP_HIT, SL_HIT)
- Weekly view uses ISO week numbering
- Daily breakdown in weekly view shows all days with trades
- Component auto-updates when bot selection changes

---

## 🚀 FUTURE ENHANCEMENTS

- [ ] Chart visualization (line/bar charts)
- [ ] Export to CSV/PDF
- [ ] Comparison between periods
- [ ] Best/worst performing hours/days
- [ ] Trend analysis
- [ ] Performance predictions

---

**Status**: ✅ Complete
**Date**: December 2024
**Version**: 1.0.0


