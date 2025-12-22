# Bot Marketplace Access Guide

## How to Access the Marketplace

### 1. **Frontend Access (Web UI)**

Navigate to:
```
http://localhost:3000/marketplace
```

Or in production:
```
https://yourdomain.com/marketplace
```

**Features**:
- Browse all available bots
- Search bots by name/description
- Filter by category, risk level, broker
- Sort by popularity, win rate, profit factor
- View bot details
- Install bots

### 2. **API Access**

#### Get All Bots
```bash
GET /api/marketplace/bots
```

**Query Parameters**:
- `category` - Filter by category (e.g., 'trend-following', 'scalping')
- `riskLevel` - Filter by risk ('low', 'medium', 'high')
- `broker` - Filter by broker ('exness', 'deriv')
- `accountType` - Filter by account type ('demo', 'live')
- `market` - Filter by market type
- `isPremium` - Filter premium bots (true/false)
- `isFeatured` - Filter featured bots (true/false)
- `tags` - Filter by tags (comma-separated)
- `search` - Search in name/description
- `sort` - Sort option ('popular', 'newest', 'winRate', 'profitFactor', 'name', 'featured')
- `page` - Page number (default: 1)
- `pageSize` - Items per page (default: 20)

**Example**:
```bash
GET /api/marketplace/bots?category=trend-following&riskLevel=medium&sort=popular
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "botId": "signalist-sma-3c",
      "displayName": "Signalist SMA-3C",
      "shortDescription": "Trend-following strategy...",
      "category": "trend-following",
      "riskLevel": "medium",
      "isFeatured": true,
      "isPremium": false,
      "pricing": { "type": "free" },
      "performance": {
        "winRate": 65.5,
        "profitFactor": 1.85
      }
    }
  ],
  "total": 4,
  "page": 1,
  "pageSize": 20,
  "totalPages": 1
}
```

#### Get Bot Details
```bash
GET /api/marketplace/bots/[botId]
```

**Example**:
```bash
GET /api/marketplace/bots/signalist-sma-3c
```

**Response**:
```json
{
  "success": true,
  "data": {
    "botId": "signalist-sma-3c",
    "displayName": "Signalist SMA-3C",
    "description": "Full description...",
    "configuration": { ... },
    "strategyConfig": { ... },
    "fullPerformance": { ... }
  }
}
```

### 3. **From Frontend Code**

```typescript
// Fetch all bots
const response = await fetch('/api/marketplace/bots?sort=popular');
const data = await response.json();
const bots = data.data;

// Fetch specific bot
const botResponse = await fetch('/api/marketplace/bots/signalist-sma-3c');
const botData = await botResponse.json();
const bot = botData.data;
```

### 4. **Navigation Links**

Add to your navigation menu:
```tsx
<Link href="/marketplace">
  Bot Marketplace
</Link>
```

### 5. **Direct Bot Links**

Link to specific bot:
```tsx
<Link href="/marketplace/signalist-sma-3c">
  View Signalist SMA-3C Bot
</Link>
```

## Available Sample Bots

1. **Signalist SMA-3C** (`signalist-sma-3c`)
   - Featured, Free, Medium Risk
   - URL: `/marketplace/signalist-sma-3c`

2. **Conservative Scalper** (`conservative-scalper`)
   - Free, Low Risk
   - URL: `/marketplace/conservative-scalper`

3. **Trend Follower Pro** (`trend-follower-pro`)
   - Featured, Premium ($29.99/month), High Risk
   - URL: `/marketplace/trend-follower-pro`

4. **Breakout Hunter** (`breakout-hunter`)
   - Free, Medium Risk
   - URL: `/marketplace/breakout-hunter`

## Features

### Marketplace Page (`/marketplace`)
- ✅ Search bots
- ✅ Filter by category, risk, broker
- ✅ Sort options
- ✅ Bot cards with preview
- ✅ Featured/Premium badges
- ✅ Performance metrics display

### Bot Detail Page (`/marketplace/[botId]`)
- ✅ Full bot description
- ✅ Performance metrics
- ✅ Configuration details
- ✅ Strategy information
- ✅ Install button (ready for implementation)
- ✅ Documentation/Support links

## Next Steps

1. **Seed Database** (Optional):
   ```typescript
   import { BotMarketplace } from '@/database/models/bot-marketplace.model';
   import { sampleBotDefinitions } from '@/lib/marketplace/sample-bot-definitions';
   
   await BotMarketplace.insertMany(sampleBotDefinitions);
   ```

2. **Add Navigation Link**:
   Add marketplace link to your main navigation

3. **Implement Install Functionality**:
   Connect install button to bot installation service

4. **Add User Favorites**:
   Allow users to favorite/bookmark bots

5. **Add Reviews/Ratings**:
   User reviews and ratings for bots

## Testing

1. Start your development server
2. Navigate to `/marketplace`
3. Browse bots, use filters, view details
4. Test API endpoints directly

## Authentication

All marketplace endpoints require authentication. Users must be logged in to access.

