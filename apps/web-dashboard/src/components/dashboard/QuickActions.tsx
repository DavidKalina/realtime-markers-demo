"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface QuickActionsProps {
  className?: string;
}

export function QuickActions({ className }: QuickActionsProps) {
  return (
    <Card className={className}>
      <CardContent className="p-6">
        <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
        <Tabs defaultValue="analytics" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              📊 Analytics
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2">
              👥 Users
            </TabsTrigger>
            <TabsTrigger value="events" className="flex items-center gap-2">
              🎉 Events
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              ⚙️ Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="analytics" className="mt-4">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Analytics Dashboard</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Total Events</p>
                  <p className="text-2xl font-bold">1,234</p>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Active Users</p>
                  <p className="text-2xl font-bold">567</p>
                </div>
              </div>
              <Button className="w-full">View Detailed Analytics</Button>
            </div>
          </TabsContent>

          <TabsContent value="users" className="mt-4">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">User Management</h3>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Manage user accounts, permissions, and roles
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    View All Users
                  </Button>
                  <Button variant="outline" size="sm">
                    Add New User
                  </Button>
                  <Button variant="outline" size="sm">
                    Manage Roles
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="events" className="mt-4">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Event Management</h3>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Create and manage events
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    Create Event
                  </Button>
                  <Button variant="outline" size="sm">
                    View Events
                  </Button>
                  <Button variant="outline" size="sm">
                    Event Templates
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="settings" className="mt-4">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">System Settings</h3>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Configure system preferences and integrations
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    General Settings
                  </Button>
                  <Button variant="outline" size="sm">
                    API Keys
                  </Button>
                  <Button variant="outline" size="sm">
                    Integrations
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
