import type { AccountProductSummary } from "@/lib/account-360-api";
import { Boxes } from "lucide-react";
import { AccountProductCard } from "./account-product-card";

export function AccountProducts({ accountId, products }: { accountId: string; products: AccountProductSummary[] }) {
  return (
    <section className="rounded-2xl border border-[#e3e8f2] bg-white p-4 shadow-[0_2px_8px_rgb(15_23_42/0.03)]">
      <div className="flex items-center gap-2.5">
        <span className="rounded-lg bg-violet-50 p-1.5 text-violet-600"><Boxes className="h-4 w-4" /></span>
        <div><h2 className="text-sm font-extrabold text-[var(--g66-text-primary)]">Productos</h2><p className="text-[10px] text-[var(--g66-text-muted)]">Resumen por producto · selecciona para ver el detalle</p></div>
      </div>
      {products.length ? (
        <div className="mt-3 grid items-start gap-2.5 lg:grid-cols-2">
          {products.map((product) => <AccountProductCard key={product.product_code} accountId={accountId} product={product} />)}
        </div>
      ) : <p className="mt-4 text-sm text-[var(--g66-text-muted)]">No hay productos disponibles.</p>}
    </section>
  );
}
