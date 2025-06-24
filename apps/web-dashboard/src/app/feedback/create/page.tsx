"use client";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function CreateFeedbackPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    type: "IDEA" as "POSITIVE_FEEDBACK" | "NEGATIVE_FEEDBACK" | "IDEA",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // TODO: Implement create civic engagement API call
      console.log("Creating feedback:", formData);

      // For now, just redirect back to feedback list
      router.push("/feedback");
    } catch (error) {
      console.error("Error creating feedback:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.back()}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                Create Feedback
              </h1>
              <p className="text-muted-foreground">
                Submit new civic engagement feedback
              </p>
            </div>
          </div>

          {/* Form */}
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle>Feedback Details</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    placeholder="Enter feedback title"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="Describe your feedback in detail"
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="type">Type</Label>
                  <select
                    id="type"
                    value={formData.type}
                    onChange={(e) =>
                      setFormData({ ...formData, type: e.target.value as any })
                    }
                    className="w-full p-2 border border-input rounded-md bg-background"
                  >
                    <option value="IDEA">Idea</option>
                    <option value="POSITIVE_FEEDBACK">Positive Feedback</option>
                    <option value="NEGATIVE_FEEDBACK">Negative Feedback</option>
                  </select>
                </div>

                <div className="flex gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.back()}
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={loading}>
                    {loading ? "Creating..." : "Create Feedback"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
