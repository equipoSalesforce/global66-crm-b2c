import type { AccountSummaryMetricsData } from "@/lib/account-360-api";
import { ChartNoAxesCombined, MessagesSquare, Paperclip, WalletCards } from "lucide-react";
import { formatMoney } from "./account-360-format";

export function AccountSummaryMetrics({ metrics }: { metrics: AccountSummaryMetricsData }) {
  const items = [
    { label: "Saldo total", value: formatMoney(metrics.total_balance_usd), icon: WalletCards, color: "text-blue-600 bg-blue-50" },
    { label: "Volumen histórico", value: formatMoney(metrics.historical_volume_usd), icon: ChartNoAxesCombined, color: "text-emerald-600 bg-emerald-50" },
    { label: "Interacciones", value: metrics.interactions_count.toLocaleString("es-CL"), icon: MessagesSquare, color: "text-violet-600 bg-violet-50" },
    { label: "Adjuntos", value: metrics.attachments_count.toLocaleString("es-CL"), icon: Paperclip, color: "text-amber-600 bg-amber-50" },
  ];

  return (
    <section className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
      {items.map(({ label, value, icon: Icon, color }) => (
        <article key={label} className="rounded-xl border border-[#e3e8f2] bg-white px-3 py-2.5 shadow-[0_2px_8px_rgb(15_23_42/0.03)]">
          <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.1em] text-[var(--g66-text-muted)]">
            <span className={`rounded-md p-1 ${color}`}><Icon className="h-3.5 w-3.5" /></span>{label}
          </div>
          <p className="mt-1.5 text-xl font-extrabold tracking-tight text-[var(--g66-text-primary)]">{value}</p>
        </article>
      ))}
    </section>
  );
}
