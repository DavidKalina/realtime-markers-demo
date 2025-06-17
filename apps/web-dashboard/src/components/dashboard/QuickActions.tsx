import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface QuickActionsProps {
  className?: string;
}

export function QuickActions({ className }: QuickActionsProps) {
  return (
    <Card className={className}>
      <CardContent className="p-6">
        <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Button variant="outline" className="h-12">
            📊 View Analytics
          </Button>
          <Button variant="outline" className="h-12">
            👥 Manage Users
          </Button>
          <Button variant="outline" className="h-12">
            🎉 Create Event
          </Button>
          <Button variant="outline" className="h-12">
            ⚙️ Settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
