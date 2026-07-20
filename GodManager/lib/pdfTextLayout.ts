import { getDocumentProxy } from 'unpdf';

/**
 * Extrai texto de um PDF PRESERVANDO O LAYOUT (equivalente ao `pdftotext -layout`), usando o
 * pdf.js empacotado pelo unpdf (funciona em serverless/Next, sem binários nativos).
 * Agrupa os itens de texto por linha (coordenada Y) e ordena por X, inserindo espaços conforme
 * o vão horizontal — assim data/descrição/valor ficam na mesma linha lógica, como o parser espera.
 */
export async function pdfToLayoutText(data: Uint8Array | ArrayBuffer | Buffer): Promise<string> {
  const bytes =
    data instanceof Uint8Array ? data : new Uint8Array(data as ArrayBuffer);
  const pdf = await getDocumentProxy(bytes);
  let out = '';
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    const lines = new Map<number, Array<{ x: number; s: string }>>();
    for (const it of tc.items as Array<{ str?: string; transform?: number[] }>) {
      if (!it.str || !it.transform) continue;
      const y = Math.round(it.transform[5]);
      const x = it.transform[4];
      let key: number | null = null;
      for (const k of lines.keys()) {
        if (Math.abs(k - y) <= 2) { key = k; break; }
      }
      if (key == null) { key = y; lines.set(key, []); }
      lines.get(key)!.push({ x, s: it.str });
    }
    for (const y of [...lines.keys()].sort((a, b) => b - a)) {
      const parts = lines.get(y)!.sort((a, b) => a.x - b.x);
      let line = '';
      let lastX: number | null = null;
      for (const pt of parts) {
        if (lastX != null) {
          const gap = pt.x - lastX;
          if (gap > 5) line += gap > 40 ? '    ' : ' ';
        }
        line += pt.s;
        lastX = pt.x + pt.s.length * 4;
      }
      out += line + '\n';
    }
  }
  return out;
}
