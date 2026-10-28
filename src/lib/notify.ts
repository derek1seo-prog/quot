/** Messenger alerts. Slack (Incoming Webhook) today; 카카오톡 알림톡 needs a
 * business channel + a sending provider (e.g. Solapi) and can be added here
 * as another channel without touching the callers. */

export function alertChannels(): { slack: boolean } {
  return { slack: Boolean(process.env.SLACK_WEBHOOK_URL?.trim()) };
}

/** Sends `text` to every configured channel. Resolves to the channels that
 * accepted it (empty when none is configured - not an error). */
export async function sendAlert(text: string): Promise<{ sent: string[]; failed: string[] }> {
  const sent: string[] = [];
  const failed: string[] = [];
  const slack = process.env.SLACK_WEBHOOK_URL?.trim();
  if (slack) {
    try {
      const res = await fetch(slack, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal: AbortSignal.timeout(8000),
      });
      (res.ok ? sent : failed).push("slack");
    } catch {
      failed.push("slack");
    }
  }
  return { sent, failed };
}

/** Absolute site URL for links in alerts. */
export function siteUrl(req?: Request): string {
  const configured = process.env.SITE_URL?.trim() || (process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`);
  if (configured) return configured.replace(/\/$/, "");
  return req ? new URL(req.url).origin : "";
}
