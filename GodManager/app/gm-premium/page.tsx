import { redirect } from "next/navigation";

/** Atalho: /gm-premium → rota que serve o HTML (ver app/gm/route.ts) */
export default function GmPremiumPage() {
  redirect("/gm");
}
