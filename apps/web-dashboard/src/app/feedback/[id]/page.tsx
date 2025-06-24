"use client";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  MessageSquare,
  User,
  Edit3,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/lib/use-toast";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";

interface CivicEngagement {
  id: string;
  title: string;
  description?: string;
  type: "POSITIVE_FEEDBACK" | "NEGATIVE_FEEDBACK" | "IDEA";
  status: "PENDING" | "IN_REVIEW" | "IMPLEMENTED" | "CLOSED";
  location?: {
    type: "Point";
    coordinates: [number, number];
  };
  address?: string;
  locationNotes?: string;
  imageUrls?: string[];
  creatorId: string;
  adminNotes?: string;
  implementedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// Helper function to get type display name
const getTypeName = (type: string) => {
  switch (type) {
    case "POSITIVE_FEEDBACK":
      return "Positive Feedback";
    case "NEGATIVE_FEEDBACK":
      return "Negative Feedback";
    case "IDEA":
      return "Idea";
    default:
      return type;
  }
};

// Helper function to get status display name
const getStatusName = (status: string) => {
  switch (status) {
    case "PENDING":
      return "Pending";
    case "IN_REVIEW":
      return "In Review";
    case "IMPLEMENTED":
      return "Implemented";
    case "CLOSED":
      return "Closed";
    default:
      return status;
  }
};

// Helper function to get status badge variant
const getStatusVariant = (status: string) => {
  switch (status) {
    case "PENDING":
      return "secondary";
    case "IN_REVIEW":
      return "default";
    case "IMPLEMENTED":
      return "default";
    case "CLOSED":
      return "destructive";
    default:
      return "outline";
  }
};

export default function CivicEngagementDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { toasts, toast, dismiss } = useToast();
  const [civicEngagement, setCivicEngagement] =
    useState<CivicEngagement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signedImageUrl, setSignedImageUrl] = useState<string | null>(null);

  // Status update form state
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
  const [statusUpdateLoading, setStatusUpdateLoading] = useState(false);
  const [newStatus, setNewStatus] = useState<string>("");
  const [adminNotes, setAdminNotes] = useState<string>("");
  const [statusUpdateSuccess, setStatusUpdateSuccess] = useState(false);

  const id = params.id as string;

  useEffect(() => {
    const fetchCivicEngagement = async () => {
      if (!id) return;

      try {
        setLoading(true);
        setError(null);
        const data = await api.getCivicEngagementById(id);
        setCivicEngagement(data);
        // Fetch signed image URL if there are images
        if (data.imageUrls && data.imageUrls.length > 0) {
          const signedUrl = await api.getCivicEngagementSignedImageUrl(id);
          setSignedImageUrl(signedUrl);
        } else {
          setSignedImageUrl(null);
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to fetch civic engagement",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchCivicEngagement();
  }, [id]);

  const handleStatusUpdate = async () => {
    if (!newStatus || !civicEngagement) return;

    try {
      setStatusUpdateLoading(true);
      setStatusUpdateSuccess(false);

      // Call the admin status update API
      await api.patch<CivicEngagement & { message?: string }>(
        `/api/civic-engagements/${id}/status`,
        {
          status: newStatus,
          adminNotes: adminNotes || undefined,
        },
      );

      // Reset form
      setNewStatus("");
      setAdminNotes("");
      setIsStatusDialogOpen(false);

      // Refresh the civic engagement data to ensure we have the latest state
      const refreshedData = await api.getCivicEngagementById(id);
      setCivicEngagement(refreshedData);

      // Refresh signed image URL if there are images
      if (refreshedData.imageUrls && refreshedData.imageUrls.length > 0) {
        const signedUrl = await api.getCivicEngagementSignedImageUrl(id);
        setSignedImageUrl(signedUrl);
      }

      // Show success feedback
      setStatusUpdateSuccess(true);
      setTimeout(() => setStatusUpdateSuccess(false), 3000); // Hide after 3 seconds

      // Show toast notification
      toast({
        title: "Status Updated",
        description: `Civic engagement status changed to ${getStatusName(newStatus)}`,
      });

      console.log("Status updated successfully");
    } catch (err) {
      console.error("Failed to update status:", err);

      // Show error toast
      toast({
        title: "Update Failed",
        description:
          err instanceof Error ? err.message : "Failed to update status",
        variant: "destructive",
      });
    } finally {
      setStatusUpdateLoading(false);
    }
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="p-8 text-center text-muted-foreground">
            Loading civic engagement...
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    );
  }

  if (error || !civicEngagement) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="p-8 text-center text-destructive">
            {error || "Civic engagement not found"}
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <ToastProvider>
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
                  {civicEngagement.title}
                </h1>
                <p className="text-muted-foreground">
                  Civic Engagement Details
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Content */}
              <div className="lg:col-span-2 space-y-6">
                {/* Description */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MessageSquare className="h-5 w-5" />
                      Description
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      {civicEngagement.description || "No description provided"}
                    </p>
                  </CardContent>
                </Card>

                {/* Location */}
                {civicEngagement.address && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <MapPin className="h-5 w-5" />
                        Location
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground">
                        {civicEngagement.address}
                      </p>
                      {civicEngagement.locationNotes && (
                        <p className="text-sm text-muted-foreground mt-2">
                          {civicEngagement.locationNotes}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Admin Notes */}
                {civicEngagement.adminNotes && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Admin Notes</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground">
                        {civicEngagement.adminNotes}
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* Images */}
                {signedImageUrl && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Image</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 gap-4">
                        <div className="aspect-video w-full overflow-hidden rounded-lg">
                          <img
                            src={signedImageUrl}
                            alt="Civic engagement image"
                            className="h-full w-full object-cover"
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                {/* Status and Type */}
                <Card>
                  <CardHeader>
                    <CardTitle>Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Type
                      </label>
                      <div className="mt-1">
                        <Badge variant="outline">
                          {getTypeName(civicEngagement.type)}
                        </Badge>
                      </div>
                    </div>
                    <Separator />
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Status
                      </label>
                      <div className="mt-1">
                        <Badge
                          variant={getStatusVariant(civicEngagement.status)}
                        >
                          {getStatusName(civicEngagement.status)}
                        </Badge>
                        {statusUpdateLoading && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            Updating...
                          </span>
                        )}
                      </div>
                    </div>
                    {statusUpdateSuccess && (
                      <div className="text-sm text-green-600 bg-green-50 p-2 rounded-md border border-green-200">
                        ✓ Status updated successfully!
                      </div>
                    )}
                    <Separator />
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Created
                      </label>
                      <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        {format(
                          new Date(civicEngagement.createdAt),
                          "MMM d, yyyy 'at' h:mm a",
                        )}
                      </div>
                    </div>
                    <Separator />
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Last Updated
                      </label>
                      <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        {format(
                          new Date(civicEngagement.updatedAt),
                          "MMM d, yyyy 'at' h:mm a",
                        )}
                      </div>
                    </div>
                    {civicEngagement.implementedAt && (
                      <>
                        <Separator />
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">
                            Implemented
                          </label>
                          <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="h-4 w-4" />
                            {format(
                              new Date(civicEngagement.implementedAt),
                              "MMM d, yyyy 'at' h:mm a",
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* Creator Info */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      Creator
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Creator ID: {civicEngagement.creatorId}
                    </p>
                  </CardContent>
                </Card>

                {/* Actions */}
                <Card>
                  <CardHeader>
                    <CardTitle>Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {/* Admin Status Update */}
                    {user?.role === "ADMIN" && (
                      <Dialog
                        open={isStatusDialogOpen}
                        onOpenChange={setIsStatusDialogOpen}
                      >
                        <DialogTrigger asChild>
                          <Button className="w-full" variant="outline">
                            <Edit3 className="h-4 w-4 mr-2" />
                            Update Status
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>
                              Update Civic Engagement Status
                            </DialogTitle>
                            <DialogDescription>
                              Change the status of this civic engagement and add
                              admin notes.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <Label htmlFor="status">Status</Label>
                              <Select
                                value={newStatus}
                                onValueChange={setNewStatus}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select a status" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="PENDING">
                                    Pending
                                  </SelectItem>
                                  <SelectItem value="IN_REVIEW">
                                    In Review
                                  </SelectItem>
                                  <SelectItem value="IMPLEMENTED">
                                    Implemented
                                  </SelectItem>
                                  <SelectItem value="CLOSED">Closed</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label htmlFor="adminNotes">
                                Admin Notes (Optional)
                              </Label>
                              <Textarea
                                id="adminNotes"
                                placeholder="Add any admin notes about this status change..."
                                value={adminNotes}
                                onChange={(e) => setAdminNotes(e.target.value)}
                                rows={3}
                              />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button
                              variant="outline"
                              onClick={() => setIsStatusDialogOpen(false)}
                            >
                              Cancel
                            </Button>
                            <Button
                              onClick={handleStatusUpdate}
                              disabled={!newStatus || statusUpdateLoading}
                            >
                              {statusUpdateLoading
                                ? "Updating..."
                                : "Update Status"}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}

                    {/* Regular Actions */}
                    <Button className="w-full" variant="outline">
                      Edit Feedback
                    </Button>
                    <Button className="w-full" variant="destructive">
                      Delete Feedback
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>

          <ToastViewport />
          {toasts.map((t) => (
            <Toast key={t.id} variant={t.variant}>
              <div className="grid gap-1">
                <ToastTitle>{t.title}</ToastTitle>
                {t.description && (
                  <ToastDescription>{t.description}</ToastDescription>
                )}
              </div>
              <ToastClose onClick={() => dismiss(t.id)} />
            </Toast>
          ))}
        </ToastProvider>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
