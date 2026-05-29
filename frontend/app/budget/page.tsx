import { DashboardShell } from "@/components/DashboardShell";
import { BudgetTable } from "@/components/BudgetTable";

export default function BudgetPage() {
  return (
    <DashboardShell>
      <BudgetTable />
    </DashboardShell>
  );
}
