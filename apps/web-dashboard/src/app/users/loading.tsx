import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { LoadingSpinner } from "@/components/dashboard/LoadingSpinner";

export default function UsersLoading() {
  return (
    <DashboardLayout>
      <LoadingSpinner message="Loading users..." />
    </DashboardLayout>
  );
}
