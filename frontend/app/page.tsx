import { DashboardShell } from "@/components/DashboardShell";
import { SimulatorWorkspace } from "@/components/SimulatorWorkspace";

export default function HomePage() {
  return (
    <DashboardShell>
      <SimulatorWorkspace />
    </DashboardShell>
  );
}
