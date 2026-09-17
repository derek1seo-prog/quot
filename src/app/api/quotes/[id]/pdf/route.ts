import { NextRequest, NextResponse } from "next/server";
import { getQuoteById } from "@/lib/data-store";

// Puppeteer needs a real Node.js process (spawns a Chromium binary), not
// the Edge runtime.
export const runtime = "nodejs";
// Cold-starting Chromium + navigating + rendering can take a few seconds -
// Vercel's Hobby plan hard-caps functions at 10s regardless of this value,
// so this only takes effect on plans that allow a longer duration.
export const maxDuration = 30;

/**
 * Launches Chromium via puppeteer-core. On Vercel (and other Lambda-like
 * serverless platforms) this uses @sparticuz/chromium's prebuilt binary,
 * since a full Chromium install isn't available there. Locally, it expects
 * PUPPETEER_EXECUTABLE_PATH to point at a real Chrome/Chromium install.
 */
async function launchBrowser() {
  const puppeteer = await import("puppeteer-core");
  if (process.env.VERCEL) {
    const chromium = (await import("@sparticuz/chromium")).default;
    return puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (!executablePath) {
    throw new Error(
      "PUPPETEER_EXECUTABLE_PATH must point at a local Chrome/Chromium install for PDF export outside Vercel.",
    );
  }
  return puppeteer.launch({ executablePath, headless: true, args: ["--no-sandbox"] });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const quote = await getQuoteById(id);
  if (!quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  let browser;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    const printUrl = new URL(`/quotes/${id}/print`, req.nextUrl.origin).toString();
    await page.goto(printUrl, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({
      preferCSSPageSize: true,
      printBackground: true,
    });

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${quote.quoteNumber}.pdf"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "PDF generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    await browser?.close();
  }
}
