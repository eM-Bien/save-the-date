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

function formatDate(value: string) {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Emails the picked range via Resend's HTTP API (no SDK needed).
 * Silently does nothing when the env vars are absent, so local runs and
 * previews still work without credentials.
 */
async function notifyByEmail(pick: Pick): Promise<{ sent: boolean; reason?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.NOTIFY_EMAIL;
  // Resend's shared sender works without verifying a domain, but it can then
  // only deliver to the address that owns the Resend account.
  const from = process.env.NOTIFY_FROM ?? "Save the Date <onboarding@resend.dev>";

  if (!apiKey || !to) {
    return { sent: false, reason: "RESEND_API_KEY or NOTIFY_EMAIL not set" };
  }

  const range = `${formatDate(pick.from)} → ${formatDate(pick.to)}`;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: `He said yes — London ${range} 💗`,
        text: `He picked the date!\n\n${range}\n\nfrom: ${pick.from}\nto:   ${pick.to}\nsaved: ${pick.savedAt}\n`,
        html: `<div style="font-family:system-ui,sans-serif;line-height:1.6">
  <h2 style="margin:0 0 8px">He picked the date! 💗</h2>
  <p style="font-size:20px;margin:0 0 16px"><strong>${range}</strong></p>
  <p style="color:#666;margin:0">from ${pick.from} to ${pick.to}<br>saved ${pick.savedAt}</p>
</div>`,
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return { sent: false, reason: `Resend responded ${response.status}: ${detail.slice(0, 300)}` };
    }

    return { sent: true };
  } catch (error) {
    return { sent: false, reason: error instanceof Error ? error.message : "unknown error" };
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

  // Write the record first: locally it is the durable copy, and a mail hiccup
  // must not cost us the answer or show the guest an error. Vercel's filesystem
  // is read-only, so there we skip straight to the email.
  let stored = false;
  if (!process.env.VERCEL) {
    try {
      const picks = await readPicks();
      picks.push(pick);
      await mkdir(DATA_DIR, { recursive: true });
      await writeFile(PICKS_FILE, `${JSON.stringify(picks, null, 2)}\n`, "utf8");
      stored = true;
    } catch (error) {
      console.error("[pick] could not write picks.json:", error);
    }
  }

  const mail = await notifyByEmail(pick);
  if (!mail.sent) {
    console.error("[pick] email not sent:", mail.reason);
  }

  if (!stored && !mail.sent) {
    // Nowhere to record it — better to say so than to swallow the answer.
    return Response.json({ error: "Could not save the date. Please try again." }, { status: 500 });
  }

  return Response.json({ saved: pick, stored, notified: mail.sent });
}
