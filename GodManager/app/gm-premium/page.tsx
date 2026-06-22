import { redirect } from "next/navigation";
import { getGodManagerPremiumUrl } from "@/lib/godmanager-premium-url";

/** Atalho: /gm-premium → HTML Premium com ?v= (cache-bust) */
export default function GmPremiumPage() {
  redirect(getGodManagerPremiumUrl());
}
