'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  CheckCircle2, 
  ArrowRight, 
  Link as LinkIcon, 
  Settings, 
  Play, 
  Eye,
  AlertCircle,
  Info,
  ExternalLink
} from 'lucide-react';
import Link from 'next/link';

type Step = {
  title: string;
  description: string;
  details: string[];
  icon: React.ElementType;
};

type BrokerGuide = {
  name: string;
  description: string;
  steps: Step[];
  resources: {
    title: string;
    links: { label: string; url: string }[];
  };
};

export default function TradingGuidePage() {
  const [activeBroker, setActiveBroker] = useState<'exness' | 'deriv'>('exness');

  const guides: Record<'exness' | 'deriv', BrokerGuide> = {
    exness: {
      name: 'Exness',
      description: 'Trade forex, metals, indices, and cryptocurrencies with Exness. Connect your account and start automated trading.',
      steps: [
        {
          title: 'Create Exness Account',
          description: 'Sign up for an Exness account if you don\'t have one',
          details: [
            'Visit the Exness website and create a new account',
            'Complete the registration process and verify your email',
            'Choose between a demo or live account based on your preference',
            'Complete KYC verification if trading with a live account'
          ],
          icon: LinkIcon
        },
        {
          title: 'Generate API Credentials',
          description: 'Create API keys for automated trading access',
          details: [
            'Log in to your Exness account',
            'Navigate to Settings > API Access',
            'Generate a new API key and secret',
            'Copy and securely store your API credentials',
            'Note: API keys have specific permissions - ensure trading is enabled'
          ],
          icon: Settings
        },
        {
          title: 'Connect to Signalist',
          description: 'Link your Exness account to Signalist platform',
          details: [
            'Go to Auto Trading dashboard in Signalist',
            'Click "Connect Broker" and select Exness',
            'Choose between Demo or Live mode',
            'Enter your API key and secret',
            'Click "Connect" and wait for verification',
            'Once connected, you\'ll see your account balance and status'
          ],
          icon: LinkIcon
        },
        {
          title: 'Configure Trading Settings',
          description: 'Set up your risk management and trading parameters',
          details: [
            'Navigate to Auto-Trade Settings panel',
            'Set your risk percentage (recommended: 1-2% per trade)',
            'Configure Take Profit and Stop Loss percentages',
            'Choose your trading instrument (XAUUSD, US30, NAS100)',
            'Set up trading sessions if you want time-based restrictions',
            'Enable advanced features like breakeven or trailing stops if needed'
          ],
          icon: Settings
        },
        {
          title: 'Select Trading Bot',
          description: 'Choose a bot strategy that matches your trading style',
          details: [
            'Browse the Bots Library to see available strategies',
            'Review bot parameters and performance metrics',
            'Select a bot that aligns with your risk tolerance',
            'Customize bot parameters if needed',
            'Preview the strategy on the chart'
          ],
          icon: Play
        },
        {
          title: 'Start Trading',
          description: 'Launch your automated trading bot',
          details: [
            'Review all your settings one final time',
            'Ensure your account has sufficient balance',
            'Click "Start Bot" to begin automated trading',
            'Monitor the Live Logs panel for real-time activity',
            'Watch your open trades in the Trades Table',
            'Track performance in the P/L Tracker'
          ],
          icon: Play
        },
        {
          title: 'Monitor & Manage',
          description: 'Keep track of your trades and adjust as needed',
          details: [
            'Monitor live trades in the Open Trades panel',
            'Review closed trades and performance metrics',
            'Check the Trading Statistics for win/loss ratios',
            'Adjust settings if needed (stop bot first)',
            'Set daily loss limits to protect your capital',
            'Review logs regularly to understand bot behavior'
          ],
          icon: Eye
        }
      ],
      resources: {
        title: 'Exness Resources',
        links: [
          { label: 'Exness Official Website', url: 'https://www.exness.com' },
          { label: 'API Documentation', url: 'https://developers.exness.com' },
          { label: 'Trading Instruments', url: 'https://www.exness.com/trading-instruments' }
        ]
      }
    },
    deriv: {
      name: 'Deriv',
      description: 'Trade synthetic indices (Boom/Crash) with Deriv. Perfect for 24/7 trading with controlled risk.',
      steps: [
        {
          title: 'Create Deriv Account',
          description: 'Sign up for a Deriv account',
          details: [
            'Visit the Deriv website and create a new account',
            'Complete the registration with your personal details',
            'Verify your email address',
            'Choose between demo or real account',
            'Complete identity verification for real account'
          ],
          icon: LinkIcon
        },
        {
          title: 'Generate API Token',
          description: 'Create an API token for automated access',
          details: [
            'Log in to your Deriv account',
            'Go to Account Settings > API Token',
            'Generate a new API token',
            'Copy the token immediately (it won\'t be shown again)',
            'Store the token securely',
            'Note: Tokens have specific scopes - ensure trading scope is enabled'
          ],
          icon: Settings
        },
        {
          title: 'Connect to Signalist',
          description: 'Link your Deriv account to Signalist',
          details: [
            'Open the Auto Trading dashboard',
            'Click "Connect Broker" and select Deriv',
            'Choose Demo or Live mode',
            'Enter your Deriv API token',
            'Click "Connect" to establish the connection',
            'Verify connection by checking account balance display'
          ],
          icon: LinkIcon
        },
        {
          title: 'Select Trading Instrument',
          description: 'Choose from available Boom/Crash indices',
          details: [
            'Deriv offers synthetic indices: Boom and Crash series',
            'Available instruments: BOOM1000, BOOM500, BOOM300, BOOM100',
            'Available instruments: CRASH1000, CRASH500, CRASH300, CRASH100',
            'Each instrument has different volatility characteristics',
            'Boom indices trend upward, Crash indices trend downward',
            'Select based on your trading strategy and risk preference'
          ],
          icon: Settings
        },
        {
          title: 'Configure Bot Settings',
          description: 'Set up your trading parameters',
          details: [
            'Set risk percentage per trade (recommended: 1-3%)',
            'Configure Take Profit and Stop Loss',
            'Choose your preferred Boom/Crash instrument',
            'Set trading session times (Deriv trades 24/7)',
            'Enable martingale if using that strategy',
            'Configure advanced features like trailing stops'
          ],
          icon: Settings
        },
        {
          title: 'Select & Customize Bot',
          description: 'Choose a bot strategy for synthetic indices',
          details: [
            'Browse available bots in the library',
            'Look for bots optimized for Boom/Crash trading',
            'Review strategy parameters and backtest results',
            'Customize parameters to match your risk profile',
            'Test with demo account first before going live'
          ],
          icon: Play
        },
        {
          title: 'Start Automated Trading',
          description: 'Launch your bot and monitor performance',
          details: [
            'Double-check all settings and account balance',
            'Click "Start Bot" to begin automated trading',
            'Monitor Live Logs for real-time execution',
            'Watch positions open and close automatically',
            'Track P/L in real-time through the dashboard',
            'Review statistics and adjust strategy as needed'
          ],
          icon: Play
        },
        {
          title: 'Ongoing Management',
          description: 'Monitor and optimize your trading',
          details: [
            'Regularly check open positions and their status',
            'Review closed trades and analyze performance',
            'Monitor win rate and average profit/loss',
            'Adjust risk parameters based on performance',
            'Use daily loss limits to protect capital',
            'Consider pausing during high volatility if needed'
          ],
          icon: Eye
        }
      ],
      resources: {
        title: 'Deriv Resources',
        links: [
          { label: 'Deriv Official Website', url: 'https://deriv.com' },
          { label: 'API Documentation', url: 'https://developers.deriv.com' },
          { label: 'Synthetic Indices Guide', url: 'https://deriv.com/trade-types/synthetic-indices' }
        ]
      }
    }
  };

  const currentGuide = guides[activeBroker];

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl md:text-5xl font-bold text-white">
          Trading Guide
        </h1>
        <p className="text-xl text-gray-400 max-w-3xl mx-auto">
          Step-by-step instructions for connecting and trading with Exness and Deriv brokers
        </p>
      </div>

      {/* Broker Selection */}
      <Tabs value={activeBroker} onValueChange={(v) => setActiveBroker(v as 'exness' | 'deriv')} className="w-full">
        <TabsList className="grid w-full max-w-md mx-auto grid-cols-2">
          <TabsTrigger value="exness">Exness</TabsTrigger>
          <TabsTrigger value="deriv">Deriv</TabsTrigger>
        </TabsList>

        <TabsContent value={activeBroker} className="mt-8">
          <div className="space-y-8">
            {/* Broker Info */}
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-2xl text-white">{currentGuide.name}</CardTitle>
                <CardDescription className="text-gray-400 text-base">
                  {currentGuide.description}
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Steps */}
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-white">Step-by-Step Guide</h2>
              
              {currentGuide.steps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <Card key={index} className="bg-gray-800/50 border-gray-700">
                    <CardHeader>
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0 w-12 h-12 rounded-full bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center">
                          <span className="text-yellow-500 font-bold text-lg">{index + 1}</span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <Icon className="w-5 h-5 text-yellow-500" />
                            <CardTitle className="text-xl text-white">{step.title}</CardTitle>
                          </div>
                          <CardDescription className="text-gray-400 text-base mb-4">
                            {step.description}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pl-16">
                      <ul className="space-y-3">
                        {step.details.map((detail, detailIndex) => (
                          <li key={detailIndex} className="flex items-start gap-3">
                            <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                            <span className="text-gray-300 leading-relaxed">{detail}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Resources */}
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-xl text-white flex items-center gap-2">
                  <Info className="w-5 h-5 text-yellow-500" />
                  {currentGuide.resources.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {currentGuide.resources.links.map((link, index) => (
                    <a
                      key={index}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition-colors group"
                    >
                      <span className="text-gray-300 group-hover:text-white">{link.label}</span>
                      <ExternalLink className="w-4 h-4 text-gray-500 group-hover:text-yellow-500" />
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Important Notes */}
            <Card className="bg-yellow-500/10 border-yellow-500/30">
              <CardHeader>
                <CardTitle className="text-xl text-yellow-500 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  Important Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-gray-300">
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-500">•</span>
                    <span>Always start with a demo account to familiarize yourself with the platform</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-500">•</span>
                    <span>Never share your API credentials with anyone</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-500">•</span>
                    <span>Set appropriate risk limits to protect your capital</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-500">•</span>
                    <span>Monitor your bots regularly, especially when starting out</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-500">•</span>
                    <span>Review performance metrics and adjust strategies as needed</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* CTA */}
            <div className="flex justify-center pt-4">
              <Button asChild size="lg" className="yellow-btn">
                <Link href="/autotrade" className="flex items-center gap-2">
                  Start Trading Now
                  <ArrowRight className="w-5 h-5" />
                </Link>
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}



