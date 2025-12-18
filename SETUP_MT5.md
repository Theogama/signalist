# Quick Setup Guide - MT5 Exness Auto-Trading

## 🚀 Quick Start (5 Minutes)

### Step 1: Install Python MT5 Service

```bash
# Navigate to MT5 service directory
cd mt5_service

# Install dependencies
pip install -r requirements.txt
```

### Step 2: Start MT5 Service

**IMPORTANT:** Make sure MetaTrader 5 terminal is installed and running first!

```bash
# Start the Python service
python main.py
```

You should see:
```
MT5 initialized successfully
Starting MT5 Trading Service on port 5000
```

### Step 3: Configure Environment

Add to your `.env` file in the project root:

```env
MT5_SERVICE_URL=http://localhost:5000
```

### Step 4: Start Next.js App

```bash
# In project root
npm run dev
```

### Step 5: Connect Your Account

1. Open browser: `http://localhost:3000/autotrade/mt5`
2. Click **"Connect Exness MT5"**
3. Enter your credentials:
   - **Login ID**: Your MT5 account number
   - **Password**: Your MT5 password
   - **Server**: 
     - `Exness-MT5Trial` for demo
     - `Exness-MT5Real` for live
4. Click **"Connect"**

### Step 6: Configure Settings

1. Click **"Settings"** button or go to `/autotrade/mt5-settings`
2. Configure:
   - Enable Auto Trading: ON
   - Symbol: XAUUSD (or your choice)
   - Risk Per Trade: 1%
   - Take Profit: 50 points
   - Stop Loss: 30 points
   - Max Daily Loss: 5%
   - Max Daily Trades: 10
3. Click **"Save Settings"**

### Step 7: Start Trading

1. Go back to `/autotrade/mt5`
2. Click **"Start Bot"**
3. Monitor trades in real-time!

## 📋 Requirements Checklist

- [ ] MetaTrader 5 terminal installed
- [ ] MT5 terminal running
- [ ] Python 3.8+ installed
- [ ] Python dependencies installed (`pip install -r requirements.txt`)
- [ ] MT5 service running (`python main.py`)
- [ ] Next.js app running (`npm run dev`)
- [ ] Exness MT5 account (demo or real)
- [ ] Environment variable set (`MT5_SERVICE_URL`)

## 🔧 Troubleshooting

### "MT5 initialization failed"

**Solution:**
- Make sure MT5 terminal is running
- Check if MT5 is installed correctly
- Try restarting MT5 terminal

### "Connection failed"

**Solution:**
- Verify login credentials are correct
- Check server name (Exness-MT5Real or Exness-MT5Trial)
- Ensure MT5 service is running on port 5000
- Check firewall settings

### "Settings not saving"

**Solution:**
- Check MongoDB connection
- Verify user is logged in
- Check browser console for errors

### "Trades not executing"

**Solution:**
- Verify auto-trading is enabled
- Check safety settings (margin, daily limits)
- Ensure sufficient free margin
- Check MT5 connection is active

## 🎯 Next Steps

1. **Test with Demo Account First!**
   - Always test with `Exness-MT5Trial` before live trading
   - Start with small lot sizes
   - Monitor for a few days

2. **Integrate Your Signal Source**
   - The system is ready to receive trading signals
   - Add your signal logic to trigger trades
   - Use `/api/mt5/trade/execute` endpoint

3. **Monitor Performance**
   - Check P/L tracker regularly
   - Review closed trades
   - Adjust settings based on performance

## 📞 Need Help?

- Check `MT5_INTEGRATION_README.md` for detailed documentation
- Review MT5 service logs for errors
- Check Next.js console for frontend errors
- Verify all requirements are met

---

**Happy Trading! 🚀**




