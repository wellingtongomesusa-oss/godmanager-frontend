import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Igual a noStoreHtml em next.config.js — /GodManager_Premium.html */
const NO_STORE_HTML_HEADERS: Record<string, string> = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

/**
 * Consola GodManager (single-file HTML em public/).
 * Usar: http://localhost:3101/gm — não depende do static handler servir .html na raiz.
 * Nota: em prod o middleware pode rewrite /gm → static; next.config headers() em /gm cobre esse caso.
 */
export async function GET() {
  const filePath = path.join(process.cwd(), "public", "GodManager_Premium.html");
  try {
    const html = await readFile(filePath, "utf-8");
    const res = new NextResponse(html, { status: 200 });
    for (const [key, value] of Object.entries(NO_STORE_HTML_HEADERS)) {
      res.headers.set(key, value);
    }
    return res;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const res = new NextResponse(
      `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Erro</title></head><body style="font-family:system-ui;padding:2rem"><h1>GodManager Premium</h1><p>Não foi possível ler <code>public/GodManager_Premium.html</code>.</p><pre style="background:#f5f5f5;padding:1rem;overflow:auto">${msg.replace(/</g, "&lt;")}</pre><p>cwd: ${process.cwd().replace(/</g, "&lt;")}</p></body></html>`,
      { status: 500 },
    );
    res.headers.set("Content-Type", "text/html; charset=utf-8");
    return res;
  }
}
