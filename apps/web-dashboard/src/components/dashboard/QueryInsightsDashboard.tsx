import { type QueryInsights } from "@/lib/dashboard-data";
import { PopularQueriesSection } from "./PopularQueriesSection";
import { LowHitRateQueriesSection } from "./LowHitRateQueriesSection";
import { ZeroResultQueriesSection } from "./ZeroResultQueriesSection";
import { QueryClustersSection } from "./QueryClustersSection";
import { TrendingQueriesSection } from "./TrendingQueriesSection";

interface QueryInsightsDashboardProps {
  insights: QueryInsights;
}

export function QueryInsightsDashboard({
  insights,
}: QueryInsightsDashboardProps) {
  return (
    <div className="space-y-8">
      {/* Popular Queries */}
      {insights.popularQueries.length > 0 && (
        <PopularQueriesSection queries={insights.popularQueries} />
      )}

      {/* Trending Queries */}
      {insights.trendingQueries.length > 0 && (
        <TrendingQueriesSection queries={insights.trendingQueries} />
      )}

      {/* Query Clusters */}
      {insights.queryClusters.length > 0 && (
        <QueryClustersSection clusters={insights.queryClusters} />
      )}

      {/* Low Hit Rate Queries */}
      {insights.lowHitRateQueries.length > 0 && (
        <LowHitRateQueriesSection queries={insights.lowHitRateQueries} />
      )}

      {/* Zero Result Queries */}
      {insights.zeroResultQueries.length > 0 && (
        <ZeroResultQueriesSection queries={insights.zeroResultQueries} />
      )}

      {/* Empty State */}
      {insights.popularQueries.length === 0 &&
        insights.trendingQueries.length === 0 &&
        insights.queryClusters.length === 0 &&
        insights.lowHitRateQueries.length === 0 &&
        insights.zeroResultQueries.length === 0 && (
          <div className="text-center py-12">
            <div className="text-muted-foreground">
              <p className="text-lg font-medium">No query data available</p>
              <p className="text-sm">
                Query analytics will appear here once users start searching
              </p>
            </div>
          </div>
        )}
    </div>
  );
}
