import { MarketingGlossaryClient } from "@/components/MarketingGlossaryClient";
import type { DashboardData } from "@/lib/data";

const emptyDashboardData: DashboardData = {
  configured: true,
  hasData: false,
  rows: [],
  periods: [],
  dailyBudget: 40000,
};

export default function GlossaryPage() {
  return <MarketingGlossaryClient data={emptyDashboardData} />;
}