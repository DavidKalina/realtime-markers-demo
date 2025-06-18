import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { CategoryStat } from "@/lib/dashboard-data";

interface TimeStat {
  day: string;
  time: string;
  count: number;
}

interface QuickStatsProps {
  popularCategories: CategoryStat[];
  busiestTimes: TimeStat[];
  className?: string;
}

export function QuickStats({
  popularCategories,
  busiestTimes,
  className,
}: QuickStatsProps) {
  return (
    <div className={`grid grid-cols-1 lg:grid-cols-2 gap-6 ${className}`}>
      {/* Popular Categories */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Popular Categories</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {popularCategories.slice(0, 8).map((category) => (
              <div
                key={category.id}
                className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{category.emoji}</span>
                  <div>
                    <p className="font-medium">{category.name}</p>
                    <div className="flex gap-2 text-xs text-muted-foreground">
                      <span>{category.metrics.totalEvents} events</span>
                      <span>•</span>
                      <span>{category.metrics.totalScans} scans</span>
                      {category.engagement.trend === "trending" && (
                        <>
                          <span>•</span>
                          <span className="text-green-600 font-medium">🔥</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant="secondary" className="mb-1">
                    {category.percentages.ofTotalEvents}%
                  </Badge>
                  <div className="text-xs text-muted-foreground">
                    {category.engagement.score} engagement
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Busiest Times */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Busiest Days/Times</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {busiestTimes.map((timeStat, index) => (
              <div
                key={`${timeStat.day}-${timeStat.time}`}
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-primary">
                      {index + 1}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium">{timeStat.day}</p>
                    <p className="text-sm text-muted-foreground">
                      {timeStat.time}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium">{timeStat.count}</p>
                  <p className="text-xs text-muted-foreground">events</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
