'use client';

import Link from 'next/link';

export default function NewsList({ news }: { news: MarketNewsArticle[] }) {
  if (!news || news.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-gray-500">
        No news available at the moment.
      </div>
    );
  }

  const formatTimeAgo = (timestamp: number) => {
    try {
      const date = new Date(timestamp * 1000);
      const now = new Date();
      const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
      
      if (diffInSeconds < 60) {
        return 'Just now';
      } else if (diffInSeconds < 3600) {
        const minutes = Math.floor(diffInSeconds / 60);
        return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
      } else if (diffInSeconds < 86400) {
        const hours = Math.floor(diffInSeconds / 3600);
        return `${hours} hour${hours > 1 ? 's' : ''} ago`;
      } else {
        const days = Math.floor(diffInSeconds / 86400);
        return `${days} day${days > 1 ? 's' : ''} ago`;
      }
    } catch {
      return 'Recently';
    }
  };

  return (
    <div className="watchlist-news">
      {news.map((article) => (
        <Link
          key={article.id}
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="news-item"
        >
          {article.related && (
            <span className="news-tag">{article.related}</span>
          )}
          <h3 className="news-title">{article.headline}</h3>
          <div className="news-meta">
            <span>{article.source}</span>
            {article.datetime && (
              <span className="ml-2">• {formatTimeAgo(article.datetime)}</span>
            )}
          </div>
          {article.summary && (
            <p className="news-summary">{article.summary}</p>
          )}
          <span className="news-cta">Read More →</span>
        </Link>
      ))}
    </div>
  );
}

