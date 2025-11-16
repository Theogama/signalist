import { Star } from 'lucide-react';
import { searchStocks, getWatchlistWithData, getNews } from '@/lib/actions/finnhub.actions';
import { getUserAlertsWithStockData } from '@/lib/actions/alerts.actions';
import SearchCommand from '@/components/SearchCommand';
import WatchlistTable from '@/components/WatchlistTable';
import AlertsList from '@/components/AlertsList';
import NewsList from '@/components/NewsList';

// Force dynamic rendering to ensure fresh data on each request
export const dynamic = 'force-dynamic';

const Watchlist = async () => {
    const [initialStocks, watchlist, alerts] = await Promise.all([
        searchStocks(),
        getWatchlistWithData(),
        getUserAlertsWithStockData().catch(() => []),
    ]);

    // Get news based on watchlist symbols
    const watchlistSymbols = watchlist?.map((item) => item.symbol) || [];
    const news = await getNews(watchlistSymbols.length > 0 ? watchlistSymbols : undefined).catch(() => []);

    // Empty state (show alerts panel on the right if any exist)
    if (!watchlist || watchlist.length === 0) {
        return (
            <section className="watchlist">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="watchlist-title">Watchlist</h2>
                    <SearchCommand initialStocks={initialStocks} />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                        <div className="flex watchlist-empty-container">
                            <div className="watchlist-empty">
                                <Star className="watchlist-star" />
                                <h2 className="empty-title">Your watchlist is empty</h2>
                                <p className="empty-description">
                                    Start building your watchlist by searching for stocks and clicking the star icon to add them.
                                </p>
                            </div>
                            <SearchCommand initialStocks={initialStocks} />
                        </div>
                    </div>
                    <div className="lg:col-span-1">
                        <AlertsList alerts={alerts as any} />
                    </div>
                </div>
                
                {/* News Section */}
                <div className="mt-6">
                    <h2 className="watchlist-title mb-4">News</h2>
                    <NewsList news={news as MarketNewsArticle[]} />
                </div>
            </section>
        );
    }

    return (
        <section className="watchlist">
            <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between">
                    <h2 className="watchlist-title">Watchlist</h2>
                    <SearchCommand initialStocks={initialStocks} />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                        <WatchlistTable watchlist={watchlist} />
                    </div>
                    <div className="lg:col-span-1">
                        <AlertsList alerts={alerts as any} />
                    </div>
                </div>
                
                {/* News Section */}
                <div className="mt-6">
                    <h2 className="watchlist-title mb-4">News</h2>
                    <NewsList news={news as MarketNewsArticle[]} />
                </div>
            </div>
        </section>
    );
};

export default Watchlist;