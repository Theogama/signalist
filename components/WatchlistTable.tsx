'use client';

import Link from 'next/link';
import { WATCHLIST_TABLE_HEADER } from '@/lib/constants';
import PriceAlertForm from '@/components/PriceAlertForm';
import { useEffect, useMemo, useState } from 'react';

export default function WatchlistTable({ watchlist }: WatchlistTableProps) {
  const [rows, setRows] = useState<StockWithData[]>(watchlist || []);

  useEffect(() => {
    setRows(watchlist || []);
  }, [watchlist]);

  const headers = useMemo(() => WATCHLIST_TABLE_HEADER, []);

  if (!rows || rows.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <table className="watchlist-table w-full">
        <thead>
          <tr className="table-header-row">
            {headers.map((h) => (
              <th key={h} className="table-header text-left py-3 px-4">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((item) => (
            <tr key={item.symbol} className="table-row">
              <td className="table-cell py-4 pl-4 pr-2">
                <Link href={`/stocks/${item.symbol}`} className="hover:underline">
                  {item.company}
                </Link>
              </td>
              <td className="table-cell py-4 px-2">
                <Link href={`/stocks/${item.symbol}`} className="text-gray-300 hover:text-gray-200">
                  {item.symbol}
                </Link>
              </td>
              <td className="table-cell py-4 px-2">{item.priceFormatted ?? '-'}</td>
              <td className="table-cell py-4 px-2">
                <span className={Number(item.changePercent) >= 0 ? 'text-green-500' : 'text-red-400'}>
                  {item.changeFormatted ?? '-'}
                </span>
              </td>
              <td className="table-cell py-4 px-2">{item.marketCap ?? '-'}</td>
              <td className="table-cell py-4 px-2">{item.peRatio ?? '-'}</td>
              <td className="table-cell py-4 px-2">
                <PriceAlertForm symbol={item.symbol} company={item.company} currentPrice={item.currentPrice} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
