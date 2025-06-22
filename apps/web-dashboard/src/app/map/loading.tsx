import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { LoadingSpinner } from "@/components/dashboard/LoadingSpinner";

export default function MapLoading() {
  return (
    <DashboardLayout>
      <LoadingSpinner message="Loading map..." />
    </DashboardLayout>
  );
}
