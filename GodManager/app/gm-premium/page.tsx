import { redirect } from "next/navigation";

/** Atalho: /gm-premium → ficheiro estático em public/ */
export default function GmPremiumPage() {
  redirect("/GodManager_Premium.html");
}
