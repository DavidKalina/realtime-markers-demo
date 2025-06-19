import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Search, BarChart3 } from "lucide-react";
import { useRouter } from "next/navigation";

interface PopularQuery {
  query: string;
  totalSearches: number;
  hitRate: number;
  averageResults: number;
}

interface PopularQueriesSectionProps {
  queries: PopularQuery[];
}

export function PopularQueriesSection({ queries }: PopularQueriesSectionProps) {
  const router = useRouter();

  const handleQueryClick = (query: string) => {
    router.push(`/query-insights/${encodeURIComponent(query)}`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Popular Queries
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Most frequently searched terms with their performance metrics
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
                <div className="flex items-center justify-center w-8 h-8 bg-primary/10 rounded-full">
                  <span className="text-sm font-medium text-primary">
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
                      <BarChart3 className="h-3 w-3" />
                      {query.averageResults.toFixed(1)} avg results
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant={
                    query.hitRate >= 80
                      ? "default"
                      : query.hitRate >= 50
                        ? "secondary"
                        : "destructive"
                  }
                  className="text-xs"
                >
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
