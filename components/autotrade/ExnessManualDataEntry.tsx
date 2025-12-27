'use client';

/**
 * Exness Manual Data Entry Component
 * Allows users to upload CSV/Excel files or manually enter trading data
 * COMPLIANCE: Exness does not support API trading - this is read-only diagnostics only
 */

import { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Upload, FileText, Database, AlertTriangle, Info } from 'lucide-react';
import { toast } from 'sonner';

interface ExnessTradeData {
  date: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  profitLoss: number;
  status: 'OPEN' | 'CLOSED';
}

export default function ExnessManualDataEntry() {
  const [isUploading, setIsUploading] = useState(false);
  const [lastUploadTime, setLastUploadTime] = useState<Date | null>(null);
  const [dataSource, setDataSource] = useState<'csv' | 'manual' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    
    if (!validTypes.includes(file.type) && !file.name.endsWith('.csv') && !file.name.endsWith('.xlsx')) {
      toast.error('Please upload a CSV or Excel file');
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('broker', 'exness');

      const response = await fetch('/api/diagnostics/exness/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setLastUploadTime(new Date());
        setDataSource('csv');
        toast.success(`Successfully imported ${data.data?.tradesCount || 0} trades from ${file.name}`);
      } else {
        throw new Error(data.error || 'Failed to upload file');
      }
    } catch (error: any) {
      console.error('File upload error:', error);
      toast.error(error.message || 'Failed to upload file. Please check the file format.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleManualEntry = () => {
    // Open manual entry modal/dialog
    toast.info('Manual entry form coming soon. For now, please use CSV upload.');
  };

  return (
    <Card className="border-yellow-500/50 bg-yellow-500/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-yellow-400" />
          Exness Data Entry
          <Badge variant="outline" className="border-yellow-500 text-yellow-400 bg-yellow-500/10">
            Manual / Read-Only
          </Badge>
        </CardTitle>
        <CardDescription>
          Exness does not support API trading or automated account access.
          Upload your trading data manually for diagnostics.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Compliance Warning */}
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <div className="text-xs font-semibold text-red-400 mb-1">
                ⚠️ Important: Exness Compliance Notice
              </div>
              <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside">
                <li>Exness does not provide a public trading API</li>
                <li>No automated trading or account access is possible</li>
                <li>This system is for read-only diagnostics only</li>
                <li>All data must be manually entered or uploaded</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Data Source Options */}
        <div className="space-y-3">
          <div className="text-sm font-medium text-gray-300">Data Source:</div>
          
          {/* CSV Upload */}
          <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-400" />
                <span className="text-sm text-gray-300">CSV / Excel Export</span>
              </div>
              {dataSource === 'csv' && (
                <Badge variant="outline" className="text-xs border-green-500 text-green-400">
                  Active
                </Badge>
              )}
            </div>
            <p className="text-xs text-gray-400 mb-3">
              Export your trading history from Exness MT4/MT5 and upload the CSV or Excel file.
            </p>
            <div className="space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileUpload}
                className="hidden"
                id="exness-file-upload"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                variant="outline"
                className="w-full"
                size="sm"
              >
                {isUploading ? (
                  <>
                    <Upload className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload CSV / Excel
                  </>
                )}
              </Button>
              {lastUploadTime && dataSource === 'csv' && (
                <div className="text-xs text-gray-500">
                  Last uploaded: {lastUploadTime.toLocaleString()}
                </div>
              )}
            </div>
          </div>

          {/* Manual Entry */}
          <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-purple-400" />
                <span className="text-sm text-gray-300">Manual Entry</span>
              </div>
              {dataSource === 'manual' && (
                <Badge variant="outline" className="text-xs border-green-500 text-green-400">
                  Active
                </Badge>
              )}
            </div>
            <p className="text-xs text-gray-400 mb-3">
              Manually enter your trades for diagnostics analysis.
            </p>
            <Button
              onClick={handleManualEntry}
              variant="outline"
              className="w-full"
              size="sm"
            >
              <Database className="h-4 w-4 mr-2" />
              Enter Trades Manually
            </Button>
          </div>
        </div>

        {/* Instructions */}
        <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <div className="text-xs font-semibold text-blue-400 mb-1">
                How to Export from Exness MT4/MT5:
              </div>
              <ol className="text-xs text-gray-400 space-y-1 list-decimal list-inside">
                <li>Open MT4/MT5 terminal</li>
                <li>Go to Account History</li>
                <li>Right-click and select "Save as Detailed Report" or "Export"</li>
                <li>Choose CSV or Excel format</li>
                <li>Upload the file here</li>
              </ol>
            </div>
          </div>
        </div>

        {/* Stale Data Warning */}
        {lastUploadTime && (
          <div className="p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <div className="text-xs text-yellow-400 flex items-center gap-2">
              <AlertCircle className="h-3 w-3" />
              <span>
                Data last updated: {lastUploadTime.toLocaleString()}
                {Date.now() - lastUploadTime.getTime() > 24 * 60 * 60 * 1000 && (
                  <span className="ml-2 font-semibold">(Data may be stale)</span>
                )}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


