"use client";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { EmojiPicker } from "@/components/dashboard/EmojiPicker";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function EmojiDemoPage() {
  const [selectedEmoji, setSelectedEmoji] = useState<string>("");

  const handleEmojiSelect = (emoji: string) => {
    setSelectedEmoji(emoji);
    console.log("Selected emoji:", emoji);
  };

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Emoji Picker Demo
            </h1>
            <p className="text-muted-foreground">
              Test the emoji picker functionality
            </p>
          </div>

          <div className="max-w-2xl">
            <Card>
              <CardHeader>
                <CardTitle>Emoji Picker Component</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <EmojiPicker
                      selectedEmoji={selectedEmoji}
                      onEmojiSelect={handleEmojiSelect}
                    />
                    <div>
                      <p className="text-sm font-medium">Selected Emoji:</p>
                      <p className="text-2xl">{selectedEmoji || "None"}</p>
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <p className="text-sm text-muted-foreground">
                      Click the emoji button to open the picker and select an
                      emoji for your event.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
