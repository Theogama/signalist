import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { TrendingUp, BarChart3, Bell, Zap } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="text-center space-y-6 py-12">
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white">
          Welcome to Signalist
        </h1>
        <p className="text-xl text-gray-400 max-w-2xl mx-auto">
          Your intelligent stock tracking and trading platform. Monitor your watchlist, 
          get real-time alerts, and make informed trading decisions.
        </p>
        <div className="flex gap-4 justify-center pt-4">
          <Button asChild className="yellow-btn">
            <Link href="/dashboard">Go to Dashboard</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/watchlist">View Watchlist</Link>
          </Button>
        </div>
      </section>

      {/* Features Section */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="p-6 bg-gray-800 rounded-lg space-y-3">
          <TrendingUp className="w-8 h-8 text-yellow-500" />
          <h3 className="text-xl font-semibold text-white">Real-time Tracking</h3>
          <p className="text-gray-400">
            Monitor your favorite stocks with live price updates and market data.
          </p>
        </div>

        <div className="p-6 bg-gray-800 rounded-lg space-y-3">
          <Bell className="w-8 h-8 text-yellow-500" />
          <h3 className="text-xl font-semibold text-white">Smart Alerts</h3>
          <p className="text-gray-400">
            Get notified when stocks hit your target prices or meet your criteria.
          </p>
        </div>

        <div className="p-6 bg-gray-800 rounded-lg space-y-3">
          <BarChart3 className="w-8 h-8 text-yellow-500" />
          <h3 className="text-xl font-semibold text-white">Analytics</h3>
          <p className="text-gray-400">
            Track your portfolio performance with detailed analytics and insights.
          </p>
        </div>

        <div className="p-6 bg-gray-800 rounded-lg space-y-3">
          <Zap className="w-8 h-8 text-yellow-500" />
          <h3 className="text-xl font-semibold text-white">Auto Trading</h3>
          <p className="text-gray-400">
            Automate your trading strategies with our advanced bot system.
          </p>
        </div>
      </section>

      {/* Quick Links */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-white">Quick Links</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Button asChild variant="outline" className="h-auto py-4 flex flex-col items-start">
            <Link href="/dashboard">
              <span className="font-semibold">Dashboard</span>
              <span className="text-sm text-gray-500">View your portfolio overview</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-auto py-4 flex flex-col items-start">
            <Link href="/watchlist">
              <span className="font-semibold">Watchlist</span>
              <span className="text-sm text-gray-500">Manage your stock watchlist</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-auto py-4 flex flex-col items-start">
            <Link href="/autotrade">
              <span className="font-semibold">Auto Trading</span>
              <span className="text-sm text-gray-500">Configure trading bots</span>
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
