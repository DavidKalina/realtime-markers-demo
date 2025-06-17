import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface CategoryStat {
  name: string;
  count: number;
  percentage: number;
  emoji: string;
}

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
            {popularCategories.map((category) => (
              <div
                key={category.name}
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{category.emoji}</span>
                  <div>
                    <p className="font-medium">{category.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {category.count} events
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant="secondary">{category.percentage}%</Badge>
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
