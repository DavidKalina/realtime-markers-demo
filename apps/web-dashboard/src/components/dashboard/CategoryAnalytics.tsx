import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { CategoryStat } from "@/lib/dashboard-data";

interface CategoryAnalyticsProps {
  categories: CategoryStat[];
  className?: string;
}

export function CategoryAnalytics({
  categories,
  className,
}: CategoryAnalyticsProps) {
  const topCategories = categories.slice(0, 5);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg">Category Analytics</CardTitle>
        <p className="text-sm text-muted-foreground">
          Detailed metrics and engagement for top categories
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {topCategories.map((category) => (
            <div
              key={category.id}
              className="p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{category.emoji}</span>
                  <div>
                    <h3 className="font-semibold text-lg">{category.name}</h3>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {category.metrics.totalEvents} events
                      </Badge>
                      {category.engagement.trend === "trending" && (
                        <Badge variant="default" className="bg-green-600">
                          🔥 Trending
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">
                    {category.percentages.ofTotalEvents}%
                  </div>
                  <div className="text-sm text-muted-foreground">
                    of total events
                  </div>
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-lg font-semibold">
                    {category.metrics.totalScans}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Total Scans
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold">
                    {category.metrics.totalSaves}
                  </div>
                  <div className="text-xs text-muted-foreground">Saves</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold">
                    {category.metrics.totalViews}
                  </div>
                  <div className="text-xs text-muted-foreground">Views</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold">
                    {category.engagement.score}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Engagement
                  </div>
                </div>
              </div>

              {/* Progress Bars */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Event Distribution</span>
                  <span>{category.percentages.ofTotalEvents}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(category.percentages.ofTotalEvents, 100)}%`,
                    }}
                  />
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span>Scan Activity</span>
                  <span>{category.percentages.ofTotalScans}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-600 h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(category.percentages.ofTotalScans, 100)}%`,
                    }}
                  />
                </div>
              </div>

              {/* Recent Activity */}
              <div className="mt-4 pt-4 border-t">
                <div className="flex justify-between text-sm">
                  <span>
                    This Week: {category.metrics.eventsThisWeek} events
                  </span>
                  <span>
                    This Month: {category.metrics.eventsThisMonth} events
                  </span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>
                    Last 30 days: {category.metrics.scansLast30Days} scans
                  </span>
                  <span>
                    Avg per event: {category.engagement.avgPerEvent} engagement
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
