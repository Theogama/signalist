/**
 * Auto-Trading Zustand Store
 * Manages state for the auto-trading feature
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

// Helper function to safely parse JSON responses
async function safeJsonParse<T = any>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    const text = await response.text().catch(() => '');
    throw new Error(`Expected JSON but got ${contentType}: ${text.substring(0, 200)}`);
  }
  return response.json() as Promise<T>;
}

interface ApiResponse<T = any> {
  success: boolean;
  error?: string;
  data?: T;
  message?: string;
}

export type BrokerType = 'exness' | 'deriv' | null;
export type BotStatus = 'idle' | 'running' | 'stopping' | 'error';
export type Instrument = {
  symbol: string;
  name: string;
  broker: BrokerType;
  category?: string;
};

export interface BotConfig {
  id: string;
  name: string;
  description: string;
  parameters: {
    riskPercent: number;
    takeProfitPercent: number;
    stopLossPercent: number;
    lotSize?: number;
    maxTrades?: number;
    sessionStart?: string;
    sessionEnd?: string;
    martingale?: boolean;
    martingaleMultiplier?: number;
    [key: string]: any;
  };
}

export interface LiveLog {
  id: string;
  timestamp: Date;
  level: 'info' | 'warning' | 'error' | 'success';
  message: string;
  data?: any;
}

export interface Trade {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  entryPrice: number;
  exitPrice?: number;
  quantity: number;
  profitLoss?: number;
  status: 'OPEN' | 'CLOSED' | 'STOPPED';
  openedAt: Date;
  closedAt?: Date;
}

interface AutoTradingState {
  // Broker connection
  connectedBroker: BrokerType;
  brokerApiKey: string | null;
  brokerApiSecret: string | null;
  isConnecting: boolean;
  connectionError: string | null;

  // Instruments
  selectedInstrument: Instrument | null;
  availableInstruments: Instrument[];

  // Bot selection
  selectedBot: BotConfig | null;
  availableBots: BotConfig[];

  // Bot configuration
  botParams: BotConfig['parameters'] | null;

  // Bot status
  botStatus: BotStatus;
  botStartTime: Date | null;
  botStopTime: Date | null;

  // Live data
  liveLogs: LiveLog[];
  openTrades: Trade[];
  closedTrades: Trade[];
  balance: number;
  equity: number;
  margin: number;

  // WebSocket
  wsConnected: boolean;
  wsError: string | null;

  // Actions
  connectBroker: (broker: BrokerType, apiKey?: string, apiSecret?: string) => Promise<void>;
  connectBrokerDemo: (broker: BrokerType) => Promise<void>;
  disconnectBroker: () => void;
  setSelectedInstrument: (instrument: Instrument) => void;
  setSelectedBot: (bot: BotConfig) => void;
  updateBotParams: (params: Partial<BotConfig['parameters']>) => void;
  startBot: () => Promise<void>;
  stopBot: () => Promise<void>;
  addLog: (log: Omit<LiveLog, 'id' | 'timestamp'>) => void;
  clearLogs: () => void;
  addTrade: (trade: Trade) => void;
  updateTrade: (tradeId: string, updates: Partial<Trade>) => void;
  setBalance: (balance: number, equity: number, margin: number) => void;
  syncTrades: (openTrades: Trade[], closedTrades: Trade[]) => void;
  loadInstruments: (broker: BrokerType) => Promise<void>;
  loadBots: () => Promise<void>;
  connectWebSocket: () => void;
  disconnectWebSocket: () => void;
}

export const useAutoTradingStore = create<AutoTradingState>()(
  devtools(
    (set, get) => ({
      // Initial state
      connectedBroker: null,
      brokerApiKey: null,
      brokerApiSecret: null,
      isConnecting: false,
      connectionError: null,

      selectedInstrument: null,
      availableInstruments: [],

      selectedBot: null,
      availableBots: [],

      botParams: null,

      botStatus: 'idle',
      botStartTime: null,
      botStopTime: null,

      liveLogs: [],
      openTrades: [],
      closedTrades: [],
      balance: 0,
      equity: 0,
      margin: 0,

      wsConnected: false,
      wsError: null,

      // Connect broker (with optional API keys for live trading)
      connectBroker: async (broker, apiKey, apiSecret) => {
        set({ isConnecting: true, connectionError: null });

        try {
          const response = await fetch('/api/auto-trading/connect-broker', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ broker, apiKey, apiSecret, demo: !apiKey || !apiSecret }),
          });

          if (!response.ok) {
            const text = await response.text().catch(() => '');
            throw new Error(`Request failed: ${response.status} ${text.substring(0, 200)}`);
          }

          const data = await safeJsonParse<ApiResponse>(response);

          if (!data.success) {
            throw new Error(data.error || 'Failed to connect broker');
          }

          // Fetch demo account balance
          try {
            const accountResponse = await fetch(`/api/auto-trading/account?broker=${broker}`);
            if (accountResponse.ok) {
              const accountData = await safeJsonParse<ApiResponse>(accountResponse);
              if (accountData.success && accountData.data) {
                set({
                  connectedBroker: broker,
                  brokerApiKey: apiKey || null,
                  brokerApiSecret: apiSecret || null,
                  isConnecting: false,
                  connectionError: null,
                  balance: accountData.data.balance || 10000,
                  equity: accountData.data.equity || 10000,
                  margin: accountData.data.margin || 0,
                });
              } else {
                set({
                  connectedBroker: broker,
                  brokerApiKey: apiKey || null,
                  brokerApiSecret: apiSecret || null,
                  isConnecting: false,
                  connectionError: null,
                  balance: 10000, // Default demo balance
                  equity: 10000,
                  margin: 0,
                });
              }
            } else {
              set({
                connectedBroker: broker,
                brokerApiKey: apiKey || null,
                brokerApiSecret: apiSecret || null,
                isConnecting: false,
                connectionError: null,
                balance: 10000, // Default demo balance
                equity: 10000,
                margin: 0,
              });
            }
          } catch (error) {
            // Fallback to default balance
            set({
              connectedBroker: broker,
              brokerApiKey: apiKey || null,
              brokerApiSecret: apiSecret || null,
              isConnecting: false,
              connectionError: null,
              balance: 10000, // Default demo balance
              equity: 10000,
              margin: 0,
            });
          }

          // Load instruments for connected broker
          await get().loadInstruments(broker);
        } catch (error: any) {
          set({
            isConnecting: false,
            connectionError: error.message || 'Connection failed',
          });
          throw error;
        }
      },

      // Connect broker in demo mode (no API keys required)
      connectBrokerDemo: async (broker) => {
        await get().connectBroker(broker);
      },

      // Disconnect broker
      disconnectBroker: () => {
        set({
          connectedBroker: null,
          brokerApiKey: null,
          brokerApiSecret: null,
          selectedInstrument: null,
          availableInstruments: [],
          botStatus: 'idle',
        });
      },

      // Set selected instrument
      setSelectedInstrument: (instrument) => {
        set({ selectedInstrument: instrument });
      },

      // Set selected bot
      setSelectedBot: (bot) => {
        set({
          selectedBot: bot,
          botParams: { ...bot.parameters },
        });
      },

      // Update bot parameters
      updateBotParams: (params) => {
        const current = get().botParams;
        if (current) {
          set({ botParams: { ...current, ...params } });
        }
      },

      // Start bot
      startBot: async () => {
        const { selectedBot, botParams, selectedInstrument, connectedBroker } = get();

        if (!selectedBot || !botParams || !selectedInstrument) {
          throw new Error('Bot, parameters, and instrument must be selected');
        }

        set({ botStatus: 'running', botStartTime: new Date() });

        try {
          const response = await fetch('/api/auto-trading/start-bot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              botId: selectedBot.id,
              instrument: selectedInstrument.symbol,
              parameters: botParams,
              broker: connectedBroker,
            }),
          });

          if (!response.ok) {
            const text = await response.text().catch(() => '');
            throw new Error(`Request failed: ${response.status} ${text.substring(0, 200)}`);
          }

          const data = await safeJsonParse<ApiResponse>(response);

          if (!data.success) {
            throw new Error(data.error || 'Failed to start bot');
          }

          // WebSocket connection is handled by useWebSocket hook
          // No need to call connectWebSocket here
        } catch (error: any) {
          set({
            botStatus: 'error',
            connectionError: error.message,
          });
          throw error;
        }
      },

      // Stop bot
      stopBot: async () => {
        set({ botStatus: 'stopping' });

        try {
          const response = await fetch('/api/auto-trading/stop-bot', {
            method: 'POST',
          });

          if (!response.ok) {
            const text = await response.text().catch(() => '');
            throw new Error(`Request failed: ${response.status} ${text.substring(0, 200)}`);
          }

          const data = await safeJsonParse<ApiResponse>(response);

          if (!data.success) {
            throw new Error(data.error || 'Failed to stop bot');
          }

          set({
            botStatus: 'idle',
            botStopTime: new Date(),
          });

          // Disconnect WebSocket
          get().disconnectWebSocket();
        } catch (error: any) {
          set({
            botStatus: 'error',
            connectionError: error.message,
          });
          throw error;
        }
      },

      // Add log
      addLog: (log) => {
        const newLog: LiveLog = {
          ...log,
          id: `log-${Date.now()}-${Math.random()}`,
          timestamp: new Date(),
        };

        set((state) => ({
          liveLogs: [...state.liveLogs.slice(-99), newLog], // Keep last 100 logs
        }));
      },

      // Clear logs
      clearLogs: () => {
        set({ liveLogs: [] });
      },

      // Add trade
      addTrade: (trade) => {
        set((state) => ({
          openTrades: [...state.openTrades, trade],
        }));
      },

      // Update trade
      updateTrade: (tradeId, updates) => {
        set((state) => {
          const existingOpen = state.openTrades.find((t) => t.id === tradeId);
          const existingClosed = state.closedTrades.find((t) => t.id === tradeId);

          // If trade exists in open trades
          if (existingOpen) {
            const updatedTrade = { ...existingOpen, ...updates };
            const openTrades = state.openTrades.filter((t) => t.id !== tradeId);
            
            if (updates.status === 'CLOSED' || updates.status === 'STOPPED') {
              // Move to closed trades
              const closedTrades = [...state.closedTrades.filter((t) => t.id !== tradeId), updatedTrade];
              return { openTrades, closedTrades };
            }
            // Keep in open trades
            return { openTrades: [...openTrades, updatedTrade] };
          }

          // If trade exists in closed trades, update it
          if (existingClosed) {
            const updatedTrade = { ...existingClosed, ...updates };
            const closedTrades = state.closedTrades.map((t) => 
              t.id === tradeId ? updatedTrade : t
            );
            return { closedTrades };
          }

          // If trade doesn't exist and has status, add it
          if (updates.status) {
            const newTrade: Trade = {
              id: tradeId,
              symbol: updates.symbol || 'UNKNOWN',
              side: updates.side || 'BUY',
              entryPrice: updates.entryPrice || 0,
              exitPrice: updates.exitPrice,
              quantity: updates.quantity || 1,
              profitLoss: updates.profitLoss,
              status: updates.status,
              openedAt: updates.openedAt || new Date(),
              closedAt: updates.closedAt,
            };

            if (updates.status === 'OPEN') {
              return { openTrades: [...state.openTrades, newTrade] };
            } else {
              return { closedTrades: [...state.closedTrades, newTrade] };
            }
          }

          return state;
        });
      },

      // Set balance
      setBalance: (balance, equity, margin) => {
        set({ balance, equity, margin });
      },

      // Sync trades from API
      syncTrades: (newOpenTrades, newClosedTrades) => {
        set((state) => {
          // Create maps for quick lookup
          const newOpenMap = new Map(newOpenTrades.map(t => [t.id, t]));
          const newClosedMap = new Map(newClosedTrades.map(t => [t.id, t]));

          // Update open trades - keep existing if not in new list, add new ones
          const updatedOpenTrades = [
            ...state.openTrades.filter(t => newOpenMap.has(t.id) || !newClosedMap.has(t.id)),
            ...newOpenTrades.filter(t => !state.openTrades.find(ot => ot.id === t.id))
          ];

          // Update closed trades - merge with existing, avoiding duplicates
          const closedTradesMap = new Map(state.closedTrades.map(t => [t.id, t]));
          newClosedTrades.forEach(t => closedTradesMap.set(t.id, t));
          const updatedClosedTrades = Array.from(closedTradesMap.values());

          return {
            openTrades: updatedOpenTrades,
            closedTrades: updatedClosedTrades.slice(-50), // Keep last 50 closed trades
          };
        });
      },

      // Load instruments
      loadInstruments: async (broker) => {
        if (!broker) return;

        // Check if instruments are already loaded for this broker
        const current = get().availableInstruments;
        if (current.length > 0 && current[0]?.broker === broker) {
          return; // Already loaded
        }

        // Predefined instruments
        const EXNESS_INSTRUMENTS: Instrument[] = [
          { symbol: 'XAUUSD', name: 'Gold (XAU/USD)', broker: 'exness', category: 'Metals' },
          { symbol: 'US30', name: 'Dow Jones 30', broker: 'exness', category: 'Indices' },
          { symbol: 'NAS100', name: 'Nasdaq 100', broker: 'exness', category: 'Indices' },
        ];

        const DERIV_INSTRUMENTS: Instrument[] = [
          { symbol: 'BOOM1000', name: 'Boom 1000', broker: 'deriv', category: 'Boom' },
          { symbol: 'BOOM500', name: 'Boom 500', broker: 'deriv', category: 'Boom' },
          { symbol: 'BOOM300', name: 'Boom 300', broker: 'deriv', category: 'Boom' },
          { symbol: 'BOOM100', name: 'Boom 100', broker: 'deriv', category: 'Boom' },
          { symbol: 'CRASH1000', name: 'Crash 1000', broker: 'deriv', category: 'Crash' },
          { symbol: 'CRASH500', name: 'Crash 500', broker: 'deriv', category: 'Crash' },
          { symbol: 'CRASH300', name: 'Crash 300', broker: 'deriv', category: 'Crash' },
          { symbol: 'CRASH100', name: 'Crash 100', broker: 'deriv', category: 'Crash' },
        ];

        try {
          // Try to load from API first
          const response = await fetch(`/api/auto-trading/instruments?broker=${broker}`);
          if (response.ok) {
            const data = await safeJsonParse<ApiResponse<Instrument[]>>(response);
            if (data.success && data.data && data.data.length > 0) {
              set({ availableInstruments: data.data });
              return;
            }
          }
        } catch (error) {
          console.error('Failed to load instruments from API:', error);
        }
        
        // Fallback to predefined instruments
        const instruments = broker === 'exness' ? EXNESS_INSTRUMENTS : DERIV_INSTRUMENTS;
        set({ availableInstruments: instruments });
        // Don't auto-select here - let InstrumentsSelector handle it
      },

      // Load bots
      loadBots: async () => {
        try {
          const response = await fetch('/api/auto-trading/bots');
          if (!response.ok) {
            console.error('Failed to load bots:', response.status);
            return;
          }
          const data = await safeJsonParse<ApiResponse<BotConfig[]>>(response);

          if (data.success) {
            set({ availableBots: data.data || [] });
          }
        } catch (error) {
          console.error('Failed to load bots:', error);
        }
      },

      // Connect WebSocket
      connectWebSocket: () => {
        // WebSocket implementation will be added
        set({ wsConnected: true, wsError: null });
      },

      // Disconnect WebSocket
      disconnectWebSocket: () => {
        set({ wsConnected: false });
      },
    }),
    { name: 'AutoTradingStore' }
  )
);



