import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");
const PICKS_FILE = path.join(DATA_DIR, "picks.json");

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export type Pick = {
  from: string;
  to: string;
  savedAt: string;
};

async function readPicks(): Promise<Pick[]> {
  try {
    const raw = await readFile(PICKS_FILE, "utf8");
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Pick[]) : [];
  } catch {
    // No file yet (or it got mangled) — start a fresh list.
    return [];
  }
}

export async function GET() {
  const picks = await readPicks();
  return Response.json({ latest: picks.at(-1) ?? null, count: picks.length });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const { from, to } = (body ?? {}) as { from?: unknown; to?: unknown };

  if (typeof from !== "string" || typeof to !== "string" || !ISO_DATE.test(from) || !ISO_DATE.test(to)) {
    return Response.json({ error: "Both 'from' and 'to' must be YYYY-MM-DD dates." }, { status: 400 });
  }

  if (to < from) {
    return Response.json({ error: "'to' cannot be earlier than 'from'." }, { status: 400 });
  }

  const pick: Pick = { from, to, savedAt: new Date().toISOString() };

  const picks = await readPicks();
  picks.push(pick);

  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(PICKS_FILE, `${JSON.stringify(picks, null, 2)}\n`, "utf8");

  return Response.json({ saved: pick });
}
