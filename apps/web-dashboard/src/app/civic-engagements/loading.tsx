import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { LoadingSpinner } from "@/components/dashboard/LoadingSpinner";

export default function CivicEngagementsLoading() {
  return (
    <DashboardLayout>
      <LoadingSpinner message="Loading civic engagements..." />
    </DashboardLayout>
  );
}
