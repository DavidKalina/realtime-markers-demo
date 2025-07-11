import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { LoadingSpinner } from "@/components/dashboard/LoadingSpinner";

export default function DashboardLoading() {
  return (
    <DashboardLayout>
      <LoadingSpinner message="Loading dashboard..." />
    </DashboardLayout>
  );
}
