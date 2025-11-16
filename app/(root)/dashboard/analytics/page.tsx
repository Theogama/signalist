import { getBotAnalytics } from '@/lib/actions/bot-analytics.actions';
import AnalyticsDashboard from '@/components/AnalyticsDashboard';

export const dynamic = 'force-dynamic';

export default async function AnalyticsPage() {
  const analyticsResult = await getBotAnalytics();
  const analytics = analyticsResult.success && 'data' in analyticsResult 
    ? analyticsResult.data 
    : null;

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-100 mb-2">Trading Analytics</h1>
        <p className="text-gray-400">Comprehensive performance metrics and insights</p>
      </div>

      <AnalyticsDashboard analytics={analytics} />
    </div>
  );
}


