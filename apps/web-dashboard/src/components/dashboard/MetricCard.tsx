import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  title: string;
  value: string | number;
  description?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  icon?: React.ReactNode;
  className?: string;
}

export function MetricCard({
  title,
  value,
  description,
  trend,
  icon,
  className,
}: MetricCardProps) {
  return (
    <Card className={cn("", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon && <div className="h-4 w-4 text-muted-foreground">{icon}</div>}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
        {trend && (
          <div className="flex items-center mt-2">
            <Badge
              variant={trend.isPositive ? "default" : "destructive"}
              className="text-xs"
            >
              {trend.isPositive ? "+" : ""}
              {trend.value}%
            </Badge>
            <span className="text-xs text-muted-foreground ml-2">
              from last month
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
