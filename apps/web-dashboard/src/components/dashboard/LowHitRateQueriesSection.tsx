import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Search, Clock } from "lucide-react";
import { useRouter } from "next/navigation";

interface LowHitRateQuery {
  query: string;
  totalSearches: number;
  hitRate: number;
  lastSearched: Date;
}

interface LowHitRateQueriesSectionProps {
  queries: LowHitRateQuery[];
}

export function LowHitRateQueriesSection({
  queries,
}: LowHitRateQueriesSectionProps) {
  const router = useRouter();

  const formatDate = (date: Date) => {
    const dateObj = date instanceof Date ? date : new Date(date);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(dateObj);
  };

  const handleQueryClick = (query: string) => {
    router.push(`/query-insights/${encodeURIComponent(query)}`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-orange-600" />
          Low Hit Rate Queries
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Queries with less than 50% success rate that may need attention
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {queries.map((query, index) => (
            <div
              key={query.query}
              className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
              onClick={() => handleQueryClick(query.query)}
            >
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-8 h-8 bg-orange-100 rounded-full">
                  <span className="text-sm font-medium text-orange-600">
                    {index + 1}
                  </span>
                </div>
                <div>
                  <h4 className="font-medium">{query.query}</h4>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Search className="h-3 w-3" />
                      {query.totalSearches} searches
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDate(query.lastSearched)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="destructive" className="text-xs">
                  {query.hitRate.toFixed(1)}% hit rate
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
