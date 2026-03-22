"use client";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { LoadingSpinner } from "@/components/dashboard/LoadingSpinner";
import {
  districtManagementService,
  type AdminDistrict,
  type AdminDistrictItinerary,
  type ClusteringConfig,
} from "@/services/districtManagement";
import { useToast } from "@/contexts/ToastContext";
import { useCallback, useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  RefreshCw,
  Trash2,
  Eye,
  Pencil,
  Settings,
  Loader2,
} from "lucide-react";

export default function DistrictsPage() {
  const [districts, setDistricts] = useState<AdminDistrict[]>([]);
  const [config, setConfig] = useState<ClusteringConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<{
    district: AdminDistrict;
    itineraries: AdminDistrictItinerary[];
  } | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const { success, error } = useToast();

  const loadDistricts = useCallback(async () => {
    const [districtRes, configRes] = await Promise.all([
      districtManagementService.listDistricts(),
      districtManagementService.getConfig(),
    ]);

    if (districtRes.data) {
      setDistricts(districtRes.data.districts);
    } else {
      error(districtRes.error || "Failed to load districts");
    }

    if (configRes.data) {
      setConfig(configRes.data);
    }

    setLoading(false);
  }, [error]);

  useEffect(() => {
    loadDistricts();
  }, [loadDistricts]);

  const handleViewDetail = async (district: AdminDistrict) => {
    setActionLoading(`view-${district.id}`);
    const res = await districtManagementService.getDistrictDetail(district.id);
    setActionLoading(null);

    if (res.data) {
      setSelectedDistrict(res.data);
      setDetailOpen(true);
    } else {
      error(res.error || "Failed to load detail");
    }
  };

  const handleRename = async (id: string) => {
    setActionLoading(`rename-${id}`);
    const res = await districtManagementService.renameDistrict(id);
    setActionLoading(null);

    if (res.data) {
      success(`Renamed to "${res.data.name}"`);
      loadDistricts();
    } else {
      error(res.error || "Failed to rename");
    }
  };

  const handleRecluster = async (id: string) => {
    setActionLoading(`recluster-${id}`);
    const res = await districtManagementService.reclusterRegion(id);
    setActionLoading(null);

    if (res.data) {
      success(`Re-clustered region ${res.data.geohash}`);
      loadDistricts();
    } else {
      error(res.error || "Failed to recluster");
    }
  };

  const handleDelete = async (id: string) => {
    setActionLoading(`delete-${id}`);
    const res = await districtManagementService.deleteDistrict(id);
    setActionLoading(null);

    if (res.data) {
      success("District archived");
      loadDistricts();
    } else {
      error(res.error || "Failed to delete");
    }
  };

  const handleReclusterAll = async () => {
    setActionLoading("recluster-all");
    const res = await districtManagementService.reclusterAll();
    setActionLoading(null);

    if (res.data) {
      success(
        `Re-clustered ${res.data.regionsProcessed}/${res.data.totalRegions} regions`,
      );
      loadDistricts();
    } else {
      error(res.error || "Failed to recluster all");
    }
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <LoadingSpinner />
        </DashboardLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Districts</h1>
              <p className="text-muted-foreground">
                {districts.length} active districts
              </p>
            </div>
            <div className="flex items-center gap-3">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    disabled={actionLoading === "recluster-all"}
                  >
                    {actionLoading === "recluster-all" ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Re-cluster All
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Re-cluster all regions?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will archive all existing districts and re-cluster
                      every region from scratch. This may take a while.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleReclusterAll}>
                      Confirm
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          {/* Config Card */}
          {config && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Clustering Config
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Epsilon</span>
                    <p className="font-mono font-semibold">{config.epsilon}</p>
                    <p className="text-xs text-muted-foreground">
                      Min similarity:{" "}
                      {(1 - config.epsilon).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Min Points</span>
                    <p className="font-mono font-semibold">{config.minPoints}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">
                      Centroid Match
                    </span>
                    <p className="font-mono font-semibold">
                      {config.centroidMatchThreshold}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">
                      Seeds/City
                    </span>
                    <p className="font-mono font-semibold">
                      {config.seedPerCity}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Districts Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Itineraries</TableHead>
                    <TableHead>Avg Rating</TableHead>
                    <TableHead>Adoptions</TableHead>
                    <TableHead>Activity Tags</TableHead>
                    <TableHead>Geohash</TableHead>
                    <TableHead>Last Clustered</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {districts.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{d.name}</p>
                          {d.description && (
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {d.description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono">
                        {d.itineraryCount}
                      </TableCell>
                      <TableCell className="font-mono">
                        {d.avgRating?.toFixed(1) ?? "—"}
                      </TableCell>
                      <TableCell className="font-mono">
                        {d.totalAdoptions}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {d.activityTags.slice(0, 4).map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                          {d.activityTags.length > 4 && (
                            <Badge variant="outline" className="text-xs">
                              +{d.activityTags.length - 4}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {d.geohash}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {d.lastClusteredAt
                          ? new Date(d.lastClusteredAt).toLocaleDateString()
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleViewDetail(d)}
                            disabled={actionLoading === `view-${d.id}`}
                            title="View detail"
                          >
                            {actionLoading === `view-${d.id}` ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRename(d.id)}
                            disabled={actionLoading === `rename-${d.id}`}
                            title="Re-name via LLM"
                          >
                            {actionLoading === `rename-${d.id}` ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Pencil className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRecluster(d.id)}
                            disabled={actionLoading === `recluster-${d.id}`}
                            title="Re-cluster region"
                          >
                            {actionLoading === `recluster-${d.id}` ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCw className="h-4 w-4" />
                            )}
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Archive district"
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Archive &quot;{d.name}&quot;?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will hide the district from browse. Itineraries
                                  won&apos;t be deleted.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(d.id)}
                                >
                                  Archive
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {districts.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="text-center text-muted-foreground py-8"
                      >
                        No active districts
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Detail Dialog */}
          <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
              {selectedDistrict && (
                <>
                  <DialogHeader>
                    <DialogTitle className="flex items-center justify-between">
                      <span>{selectedDistrict.district.name}</span>
                      <Badge variant="outline">
                        {selectedDistrict.district.geohash}
                      </Badge>
                    </DialogTitle>
                    {selectedDistrict.district.description && (
                      <p className="text-sm text-muted-foreground">
                        {selectedDistrict.district.description}
                      </p>
                    )}
                  </DialogHeader>

                  {/* Stats */}
                  <div className="grid grid-cols-4 gap-4 my-4">
                    <Card>
                      <CardContent className="pt-4 pb-3 px-4">
                        <p className="text-xs text-muted-foreground">
                          Itineraries
                        </p>
                        <p className="text-2xl font-bold">
                          {selectedDistrict.district.itineraryCount}
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4 pb-3 px-4">
                        <p className="text-xs text-muted-foreground">
                          Avg Rating
                        </p>
                        <p className="text-2xl font-bold">
                          {selectedDistrict.district.avgRating?.toFixed(1) ??
                            "—"}
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4 pb-3 px-4">
                        <p className="text-xs text-muted-foreground">
                          Adoptions
                        </p>
                        <p className="text-2xl font-bold">
                          {selectedDistrict.district.totalAdoptions}
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4 pb-3 px-4">
                        <p className="text-xs text-muted-foreground">
                          Location
                        </p>
                        <p className="text-sm font-mono">
                          {selectedDistrict.district.centroidLat.toFixed(3)},{" "}
                          {selectedDistrict.district.centroidLng.toFixed(3)}
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Activity Tags */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {selectedDistrict.district.activityTags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>

                  {/* Member Itineraries */}
                  <h3 className="font-semibold mb-2">
                    Member Itineraries (
                    {selectedDistrict.itineraries.length})
                  </h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Intention</TableHead>
                        <TableHead>Activities</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Rating</TableHead>
                        <TableHead>Creator</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedDistrict.itineraries.map((it) => (
                        <TableRow key={it.id}>
                          <TableCell className="max-w-[200px] truncate">
                            {it.title || "Untitled"}
                          </TableCell>
                          <TableCell>
                            {it.intention && (
                              <Badge variant="outline" className="text-xs">
                                {it.intention}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {(it.activityTypes || [])
                                .slice(0, 3)
                                .map((a) => (
                                  <Badge
                                    key={a}
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    {a}
                                  </Badge>
                                ))}
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {it.durationHours}h
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {it.rating?.toFixed(1) ?? "—"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground truncate max-w-[120px]">
                            {it.creatorEmail}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
