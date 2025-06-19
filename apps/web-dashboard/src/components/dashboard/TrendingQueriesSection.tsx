import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Search, ArrowUpRight } from "lucide-react";

interface TrendingQuery {
  query: string;
  recentSearches: number;
  growthRate: number;
}

interface TrendingQueriesSectionProps {
  queries: TrendingQuery[];
}

export function TrendingQueriesSection({
  queries,
}: TrendingQueriesSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Trending Queries
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Queries with recent growth in search volume
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {queries.map((query, index) => (
            <div
              key={query.query}
              className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-8 h-8 bg-orange-100 rounded-full">
                  <ArrowUpRight className="h-4 w-4 text-orange-600" />
                </div>
                <div>
                  <h4 className="font-medium">{query.query}</h4>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Search className="h-3 w-3" />
                      {query.recentSearches} recent searches
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant={query.growthRate > 0 ? "default" : "secondary"}
                  className="text-xs"
                >
                  {query.growthRate > 0 ? "+" : ""}
                  {query.growthRate.toFixed(1)}% growth
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
