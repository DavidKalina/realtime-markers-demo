"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { CategoryStat } from "@/lib/dashboard-data";

interface PopularCategoriesProps {
  categories: CategoryStat[];
  className?: string;
}

export function PopularCategories({
  categories,
  className,
}: PopularCategoriesProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg">Popular Categories</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {categories.slice(0, 8).map((category) => (
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
  );
}
