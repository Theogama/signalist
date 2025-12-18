'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, 
  BarChart3, 
  Bell, 
  Zap, 
  Shield, 
  Target, 
  Activity,
  Bot,
  Settings,
  LineChart,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  PlayCircle
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useState } from 'react';

export default function LandingPage() {
  const [activeFeature, setActiveFeature] = useState(0);

  const coreFeatures = [
    {
      icon: Bot,
      title: 'Automated Trading',
      description: 'Deploy sophisticated trading bots that execute strategies 24/7. Support for Exness and Deriv brokers with advanced risk management.',
      color: 'text-yellow-500'
    },
    {
      icon: Bell,
      title: 'Smart Signals',
      description: 'Receive real-time trading signals based on technical analysis. Get alerts for entry/exit points, price movements, and market opportunities.',
      color: 'text-blue-500'
    },
    {
      icon: Shield,
      title: 'Risk Management',
      description: 'Advanced risk controls including stop-loss, take-profit, trailing stops, breakeven protection, and daily loss limits.',
      color: 'text-green-500'
    },
    {
      icon: LineChart,
      title: 'Performance Tracking',
      description: 'Comprehensive P/L tracking, win/loss ratios, live trade monitoring, and detailed analytics to optimize your strategies.',
      color: 'text-purple-500'
    }
  ];

  const valueProps = [
    {
      title: 'Professional-Grade Tools',
      description: 'Built for both beginners and advanced traders with intuitive interfaces and powerful automation capabilities.',
      icon: Settings
    },
    {
      title: 'Multi-Broker Support',
      description: 'Seamlessly connect to Exness and Deriv. Trade forex, indices, commodities, and synthetic assets from one platform.',
      icon: Target
    },
    {
      title: 'Real-Time Execution',
      description: 'Execute trades instantly with low latency. Monitor positions, manage risk, and track performance in real-time.',
      icon: Activity
    },
    {
      title: 'Customizable Strategies',
      description: 'Build, test, and deploy custom trading strategies. Configure risk parameters, trading sessions, and automation rules.',
      icon: TrendingUp
    }
  ];

  return (
    <div className="space-y-16 pb-12">
      {/* Hero Section */}
      <section className="text-center space-y-6 py-12">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-full mb-4">
          <Zap className="w-4 h-4 text-yellow-500" />
          <span className="text-sm text-yellow-500 font-medium">Professional Trading Platform</span>
        </div>
        
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight">
          Trade Smarter with
          <span className="text-yellow-500 block mt-2">Signalist</span>
        </h1>
        
        <p className="text-xl text-gray-400 max-w-3xl mx-auto leading-relaxed">
          Your all-in-one trading platform featuring automated bots, real-time signals, 
          advanced risk management, and comprehensive performance analytics. 
          Built for traders who demand precision, control, and reliability.
        </p>
        
        <div className="flex flex-wrap gap-4 justify-center pt-6">
          <Button asChild size="lg" className="yellow-btn text-lg px-8">
            <Link href="/autotrade" className="flex items-center gap-2">
              <PlayCircle className="w-5 h-5" />
              Start Trading
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="text-lg px-8">
            <Link href="/dashboard" className="flex items-center gap-2">
              View Dashboard
              <ArrowRight className="w-5 h-5" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Core Features Showcase */}
      <section className="space-y-8">
        <div className="text-center space-y-3">
          <h2 className="text-3xl md:text-4xl font-bold text-white">
            Core Features
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Everything you need to trade professionally, all in one place
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {coreFeatures.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Card 
                key={index} 
                className="bg-gray-800/50 border-gray-700 hover:border-yellow-500/50 transition-all cursor-pointer"
                onMouseEnter={() => setActiveFeature(index)}
              >
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-lg bg-gray-700/50 ${feature.color}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <CardTitle className="text-xl text-white">{feature.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-gray-400 text-base">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Value Proposition */}
      <section className="space-y-8">
        <div className="text-center space-y-3">
          <h2 className="text-3xl md:text-4xl font-bold text-white">
            Why Choose Signalist?
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Built for traders who want more control, better insights, and superior automation
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {valueProps.map((prop, index) => {
            const Icon = prop.icon;
            return (
              <div key={index} className="p-6 bg-gray-800/50 rounded-lg border border-gray-700 hover:border-yellow-500/30 transition-all">
                <div className="p-3 bg-yellow-500/10 rounded-lg w-fit mb-4">
                  <Icon className="w-6 h-6 text-yellow-500" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{prop.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{prop.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Key Capabilities */}
      <section className="space-y-6">
        <div className="text-center space-y-3">
          <h2 className="text-3xl md:text-4xl font-bold text-white">
            Platform Capabilities
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            'Automated Strategy Execution',
            'Real-Time Trade Monitoring',
            'Advanced Risk Controls',
            'Multi-Broker Integration',
            'Custom Strategy Builder',
            'Performance Analytics',
            'Live P/L Tracking',
            'Trading Session Management',
            'Breakeven & Trailing Stops'
          ].map((capability, index) => (
            <div key={index} className="flex items-center gap-3 p-4 bg-gray-800/30 rounded-lg border border-gray-700/50">
              <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
              <span className="text-gray-300">{capability}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Quick Links */}
      <section className="space-y-6">
        <div className="text-center space-y-3">
          <h2 className="text-2xl font-bold text-white">Get Started</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gray-800/50 border-gray-700 hover:border-yellow-500/50 transition-all">
            <CardHeader>
              <CardTitle className="text-white">Dashboard</CardTitle>
              <CardDescription>View your portfolio overview and trading statistics</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full">
                <Link href="/dashboard">Go to Dashboard</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-gray-800/50 border-gray-700 hover:border-yellow-500/50 transition-all">
            <CardHeader>
              <CardTitle className="text-white">Auto Trading</CardTitle>
              <CardDescription>Configure bots, connect brokers, and start automated trading</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full">
                <Link href="/autotrade">Open Auto Trading</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-gray-800/50 border-gray-700 hover:border-yellow-500/50 transition-all">
            <CardHeader>
              <CardTitle className="text-white">Trading Guide</CardTitle>
              <CardDescription>Learn how to trade with Exness and Deriv step-by-step</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full">
                <Link href="/guide">View Guide</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
