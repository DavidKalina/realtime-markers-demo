"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface TimeStat {
  day: string;
  time: string;
  count: number;
}

interface BusiestTimesProps {
  busiestTimes: TimeStat[];
  className?: string;
}

export function BusiestTimes({ busiestTimes, className }: BusiestTimesProps) {
  return (
    <Card className={className}>
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
  );
}
