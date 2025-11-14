'use client';

import React, { useEffect, useState } from 'react';
import { toggleAlertActive, deleteAlert } from '@/lib/actions/alerts.actions';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
type AlertWithStockData = AlertsListItem & { currentPrice?: number; changePercent?: number };

export default function AlertsList({ alerts }: { alerts: AlertWithStockData[] }) {
  const [rows, setRows] = useState<AlertWithStockData[]>(alerts || []);

  useEffect(() => setRows(alerts || []), [alerts]);

  const hasAlerts = rows && rows.length > 0;

  const onDelete = async (id: string) => {
    const prev = rows;
    setRows((p) => p.filter((r) => r._id !== id));
    const res = await deleteAlert(id);
    if (!res?.success) {
      setRows(prev);
      toast.error('Failed to delete alert');
    } else {
      toast.success('Alert deleted');
    }
  };

  // Get company logo/icon - using first letter of company name as a simple icon
  const getCompanyIcon = (company: string) => {
    return company.charAt(0).toUpperCase();
  };

  return (
    <div className="rounded-lg border border-gray-800 bg-[#0f0f0f] p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-100">Alerts</h3>
      </div>
      {!hasAlerts ? (
        <div className="py-8 text-center text-sm text-gray-500">
          No alerts yet. Use &quot;Add Alert&quot; in your watchlist to create one.
        </div>
      ) : (
        <div className="space-y-3 max-h-[600px] overflow-y-auto">
          {rows.map((a) => {
            const priceFormatted = typeof a.currentPrice === 'number' ? `$${a.currentPrice.toFixed(2)}` : '-';
            const changeFormatted = typeof a.changePercent === 'number' 
              ? `${a.changePercent >= 0 ? '+' : ''}${a.changePercent.toFixed(2)}%` 
              : '-';
            const changeColor = typeof a.changePercent === 'number' && a.changePercent >= 0 ? 'text-green-500' : 'text-red-400';
            const conditionText = a.condition === 'greater' ? '>' : '<';
            
            return (
              <div key={a._id} className="relative rounded-lg border border-gray-700 bg-gray-800/50 p-4 hover:border-gray-600 transition-colors">
                <button 
                  onClick={() => onDelete(a._id)} 
                  className="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-700/50 rounded transition-colors z-10"
                  aria-label="Delete alert"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                
                <div className="flex items-start gap-3 mb-3 pr-8">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-400 font-semibold text-sm">
                    {getCompanyIcon(a.company)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-200 truncate">{a.company}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{a.symbol}</div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-sm font-semibold text-gray-100">{priceFormatted}</div>
                        <div className={`text-xs font-medium ${changeColor}`}>{changeFormatted}</div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between pt-3 border-t border-gray-700">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-gray-400 mb-1">Alert:</div>
                    <div className="text-sm font-medium text-gray-200">
                      Price {conditionText} ${a.targetPrice?.toFixed(2)}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-4">
                    <div className="text-xs text-gray-500 whitespace-nowrap">Once per day</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
