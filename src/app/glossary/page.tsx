import { MarketingGlossaryClient } from "@/components/MarketingGlossaryClient";
import { getDashboardData } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function GlossaryPage() {
  const data = await getDashboardData();
  return <MarketingGlossaryClient data={data} />;
}
