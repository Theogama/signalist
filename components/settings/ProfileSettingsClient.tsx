'use client';

/**
 * Profile Settings Client Component
 * Comprehensive Signalist profile settings with trading preferences
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  User, 
  Lock, 
  TrendingUp, 
  Bell, 
  Bot, 
  Link as LinkIcon,
  BarChart3,
  Settings,
  Save
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

interface ProfileSettingsClientProps {
  user: {
    id: string;
    name: string;
    email: string;
  };
  stats: {
    totalTrades: number;
    openTrades: number;
    totalProfitLoss: number;
    winRate: number;
    totalBalance: number;
    totalROI: number;
  };
}

export default function ProfileSettingsClient({ user, stats }: ProfileSettingsClientProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  
  // Account Information
  const [accountInfo, setAccountInfo] = useState({
    name: user.name,
    email: user.email,
  });

  // Trading Preferences
  const [tradingPrefs, setTradingPrefs] = useState({
    riskTolerance: 'medium', // low, medium, high
    defaultBroker: 'demo', // exness, deriv, demo
    defaultInstrument: 'BOOM1000',
    notificationsEnabled: true,
    emailNotifications: true,
    tradeAlerts: true,
    dailySummary: true,
  });

  // Password Change
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const handleAccountUpdate = async () => {
    setLoading(true);
    try {
      // TODO: Implement account update API
      toast.success('Account information updated successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update account');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    if (passwordData.newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      // TODO: Implement password change API
      toast.success('Password changed successfully');
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (error: any) {
      toast.error(error.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const handleTradingPrefsUpdate = async () => {
    setLoading(true);
    try {
      // TODO: Implement trading preferences update API
      toast.success('Trading preferences updated successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update preferences');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Trading Statistics Summary */}
      <Card className="border-yellow-500/20 bg-yellow-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-yellow-400" />
            Trading Statistics
          </CardTitle>
          <CardDescription>Your overall trading performance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-gray-800 rounded-lg">
              <div className="text-sm text-gray-400 mb-1">Total Trades</div>
              <div className="text-2xl font-bold text-gray-100">{stats.totalTrades}</div>
              <div className="text-xs text-gray-500 mt-1">{stats.openTrades} open</div>
            </div>
            <div className="p-4 bg-gray-800 rounded-lg">
              <div className="text-sm text-gray-400 mb-1">Total P/L</div>
              <div className={`text-2xl font-bold ${
                stats.totalProfitLoss >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {stats.totalProfitLoss >= 0 ? '+' : ''}${stats.totalProfitLoss.toFixed(2)}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                ROI: {stats.totalROI >= 0 ? '+' : ''}{stats.totalROI.toFixed(2)}%
              </div>
            </div>
            <div className="p-4 bg-gray-800 rounded-lg">
              <div className="text-sm text-gray-400 mb-1">Win Rate</div>
              <div className="text-2xl font-bold text-green-400">{stats.winRate.toFixed(1)}%</div>
              <div className="text-xs text-gray-500 mt-1">All-time</div>
            </div>
            <div className="p-4 bg-gray-800 rounded-lg">
              <div className="text-sm text-gray-400 mb-1">Account Balance</div>
              <div className="text-2xl font-bold text-gray-100">${stats.totalBalance.toFixed(2)}</div>
              <div className="text-xs text-gray-500 mt-1">Total balance</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Account Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Account Information
            </CardTitle>
            <CardDescription>Update your personal information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={accountInfo.name}
                onChange={(e) => setAccountInfo({ ...accountInfo, name: e.target.value })}
                className="bg-gray-800"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={accountInfo.email}
                onChange={(e) => setAccountInfo({ ...accountInfo, email: e.target.value })}
                className="bg-gray-800"
                disabled
              />
              <p className="text-xs text-gray-500">Email cannot be changed</p>
            </div>
            <Button 
              onClick={handleAccountUpdate} 
              disabled={loading}
              className="w-full bg-yellow-500 hover:bg-yellow-600 text-gray-900"
            >
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </CardContent>
        </Card>

        {/* Security Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Security Settings
            </CardTitle>
            <CardDescription>Change your password</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <Input
                id="currentPassword"
                type="password"
                value={passwordData.currentPassword}
                onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                className="bg-gray-800"
                placeholder="Enter current password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                className="bg-gray-800"
                placeholder="Enter new password (min 8 characters)"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                className="bg-gray-800"
                placeholder="Confirm new password"
              />
            </div>
            <Button 
              onClick={handlePasswordChange} 
              disabled={loading || !passwordData.currentPassword || !passwordData.newPassword}
              className="w-full bg-yellow-500 hover:bg-yellow-600 text-gray-900"
            >
              <Lock className="h-4 w-4 mr-2" />
              Change Password
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Trading Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Trading Preferences
          </CardTitle>
          <CardDescription>Configure your default trading settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="riskTolerance">Risk Tolerance</Label>
              <Select
                value={tradingPrefs.riskTolerance}
                onValueChange={(value) => setTradingPrefs({ ...tradingPrefs, riskTolerance: value })}
              >
                <SelectTrigger className="bg-gray-800">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low - Conservative</SelectItem>
                  <SelectItem value="medium">Medium - Balanced</SelectItem>
                  <SelectItem value="high">High - Aggressive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="defaultBroker">Default Broker</Label>
              <Select
                value={tradingPrefs.defaultBroker}
                onValueChange={(value) => setTradingPrefs({ ...tradingPrefs, defaultBroker: value })}
              >
                <SelectTrigger className="bg-gray-800">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="demo">Demo Account</SelectItem>
                  <SelectItem value="exness">Exness</SelectItem>
                  <SelectItem value="deriv">Deriv</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="defaultInstrument">Default Instrument</Label>
              <Select
                value={tradingPrefs.defaultInstrument}
                onValueChange={(value) => setTradingPrefs({ ...tradingPrefs, defaultInstrument: value })}
              >
                <SelectTrigger className="bg-gray-800">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BOOM1000">BOOM1000</SelectItem>
                  <SelectItem value="CRASH1000">CRASH1000</SelectItem>
                  <SelectItem value="XAUUSD">XAUUSD</SelectItem>
                  <SelectItem value="US30">US30</SelectItem>
                  <SelectItem value="NAS100">NAS100</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button 
            onClick={handleTradingPrefsUpdate} 
            disabled={loading}
            className="w-full md:w-auto bg-yellow-500 hover:bg-yellow-600 text-gray-900"
          >
            <Save className="h-4 w-4 mr-2" />
            Save Preferences
          </Button>
        </CardContent>
      </Card>

      {/* Notification Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Preferences
          </CardTitle>
          <CardDescription>Manage how you receive updates and alerts</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
            <div className="space-y-0.5">
              <Label htmlFor="notificationsEnabled">Enable Notifications</Label>
              <p className="text-sm text-gray-500">Receive all notifications</p>
            </div>
            <Switch
              id="notificationsEnabled"
              checked={tradingPrefs.notificationsEnabled}
              onCheckedChange={(checked) => setTradingPrefs({ ...tradingPrefs, notificationsEnabled: checked })}
            />
          </div>
          <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
            <div className="space-y-0.5">
              <Label htmlFor="emailNotifications">Email Notifications</Label>
              <p className="text-sm text-gray-500">Receive email updates</p>
            </div>
            <Switch
              id="emailNotifications"
              checked={tradingPrefs.emailNotifications}
              onCheckedChange={(checked) => setTradingPrefs({ ...tradingPrefs, emailNotifications: checked })}
              disabled={!tradingPrefs.notificationsEnabled}
            />
          </div>
          <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
            <div className="space-y-0.5">
              <Label htmlFor="tradeAlerts">Trade Alerts</Label>
              <p className="text-sm text-gray-500">Get notified when trades execute</p>
            </div>
            <Switch
              id="tradeAlerts"
              checked={tradingPrefs.tradeAlerts}
              onCheckedChange={(checked) => setTradingPrefs({ ...tradingPrefs, tradeAlerts: checked })}
              disabled={!tradingPrefs.notificationsEnabled}
            />
          </div>
          <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
            <div className="space-y-0.5">
              <Label htmlFor="dailySummary">Daily Summary</Label>
              <p className="text-sm text-gray-500">Receive daily trading summary</p>
            </div>
            <Switch
              id="dailySummary"
              checked={tradingPrefs.dailySummary}
              onCheckedChange={(checked) => setTradingPrefs({ ...tradingPrefs, dailySummary: checked })}
              disabled={!tradingPrefs.notificationsEnabled}
            />
          </div>
        </CardContent>
      </Card>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/autotrade">
          <Card className="hover:border-yellow-500/50 transition-colors cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Bot className="h-5 w-5 text-yellow-400" />
                Auto Trading
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-400">Configure auto-trading bots and strategies</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/settings/brokers">
          <Card className="hover:border-yellow-500/50 transition-colors cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <LinkIcon className="h-5 w-5 text-blue-400" />
                Broker Connections
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-400">Manage your broker account connections</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard">
          <Card className="hover:border-yellow-500/50 transition-colors cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <BarChart3 className="h-5 w-5 text-green-400" />
                Trading Dashboard
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-400">View your trading statistics and performance</p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}

