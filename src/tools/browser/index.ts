import path from "node:path";
import fsp from "node:fs/promises";
import type { Browser, BrowserContext, Page } from "playwright-core";
import { resolveSafePath } from "../../security/paths.js";
import { ToolExecutionError } from "../../core/errors.js";
import { toolRegistry, type ToolContext, type ToolResult } from "../registry.js";

/**
 * Browser automation, backed by Playwright (Chromium, headless).
 *
 * One browser/context/page is lazily launched on first use and reused
 * across tool calls within a task so multi-step flows (open → click →
 * type → submit) operate on the same tab. `agent/loop.ts` calls
 * `closeBrowser()` after every task finishes (success or failure) so no
 * browser process lingers between tasks.
 *
 * Requires Chromium to be installed once via:
 *   npx playwright install chromium
 * (Pilot depends on `playwright-core`, not the full `playwright` package,
 * so `npm install` never tries to download browser binaries itself —
 * that download only happens when you explicitly ask for it.)
 */
export const BROWSER_TOOLS_IMPLEMENTED = true;

let browser: Browser | null = null;
let context: BrowserContext | null = null;
let page: Page | null = null;

async function getPage(): Promise<Page> {
  if (page && !page.isClosed()) return page;

  const { chromium } = await import("playwright-core");

  if (!browser) {
    try {
      browser = await chromium.launch({ headless: true });
    } catch (err) {
      throw new ToolExecutionError(
        "Could not launch Chromium. Run `npx playwright install chromium` once to " +
          `download browser binaries, then try again. (${
            err instanceof Error ? err.message : String(err)
          })`
      );
    }
    browser.on("disconnected", () => {
      browser = null;
      context = null;
      page = null;
    });
  }

  context = await browser.newContext();
  page = await context.newPage();
  return page;
}

/** Closes the whole browser session. Safe to call repeatedly. */
export async function closeBrowser(): Promise<void> {
  const p = page;
  const c = context;
  const b = browser;
  page = null;
  context = null;
  browser = null;
  await p?.close().catch(() => {});
  await c?.close().catch(() => {});
  await b?.close().catch(() => {});
}

function assertHttpUrl(url: string): void {
  if (!/^https?:\/\//i.test(url)) {
    throw new ToolExecutionError(
      `Refusing to navigate to "${url}" — only http:// and https:// URLs are allowed.`
    );
  }
}

/**
 * Runs inside the browser page, not Node — so it deliberately avoids
 * referencing DOM lib types (this project's tsconfig targets Node only)
 * and instead reaches the page globals through `globalThis as any`.
 */
async function extractVisibleText(target: Page): Promise<string> {
  return target.evaluate(() => {
    const w = globalThis as unknown as {
      document: {
        createTreeWalker: (root: unknown, whatToShow: number) => {
          nextNode: () => unknown;
        };
        body: unknown;
      };
      NodeFilter: { SHOW_TEXT: number };
    };
    const walker = w.document.createTreeWalker(w.document.body, w.NodeFilter.SHOW_TEXT);
    let out = "";
    let node: unknown;
    // eslint-disable-next-line no-cond-assign
    while ((node = walker.nextNode())) {
      const n = node as { parentElement?: { tagName?: string }; textContent?: string | null };
      const parentTag = n.parentElement?.tagName;
      if (parentTag === "SCRIPT" || parentTag === "STYLE") continue;
      const trimmed = n.textContent?.trim();
      if (trimmed) out += trimmed + "\n";
    }
    return out;
  });
}

toolRegistry.register({
  spec: {
    name: "browser_open",
    description:
      "Navigate the browser tab to a URL (launching a headless Chromium session if none is " +
      "open yet) and return the page title plus its visible text. Only http:// and https:// " +
      "URLs are allowed.",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "Full http(s) URL to navigate to." },
      },
      required: ["url"],
    },
  },
  classifyRisk: () => "safe",
  describe: (args) => `Open ${args.url} in browser`,
  run: async (args): Promise<ToolResult> => {
    const url = String(args.url ?? "");
    assertHttpUrl(url);
    const p = await getPage();
    await p.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    const title = await p.title();
    const text = (await extractVisibleText(p)).slice(0, 3000);
    return { ok: true, output: `Opened ${url}\nTitle: ${title}\n\n${text}` };
  },
});

toolRegistry.register({
  spec: {
    name: "browser_click",
    description:
      "Click an element on the currently open page, identified by a CSS selector or by its " +
      "visible text (used if selector is omitted). Use for links, buttons, and form submission.",
    parameters: {
      type: "object",
      properties: {
        selector: { type: "string", description: "CSS selector of the element to click." },
        text: {
          type: "string",
          description: "Visible text of the element to click, used only if selector is omitted.",
        },
      },
    },
  },
  classifyRisk: () => "review",
  describe: (args) => (args.selector ? `Click "${args.selector}"` : `Click text "${args.text}"`),
  run: async (args): Promise<ToolResult> => {
    const p = await getPage();
    const locator = args.selector
      ? p.locator(String(args.selector))
      : p.getByText(String(args.text ?? ""), { exact: false });
    await locator.first().click({ timeout: 10_000 });
    await p.waitForLoadState("domcontentloaded", { timeout: 10_000 }).catch(() => {});
    return { ok: true, output: `Clicked. Page is now "${await p.title()}" (${p.url()})` };
  },
});

toolRegistry.register({
  spec: {
    name: "browser_type",
    description:
      "Type text into an input or textarea on the current page, identified by a CSS selector. " +
      "Replaces any existing value. Does not submit the form — use browser_click on the submit " +
      "button afterward if that's needed.",
    parameters: {
      type: "object",
      properties: {
        selector: { type: "string", description: "CSS selector of the input/textarea." },
        text: { type: "string", description: "Text to type into the field." },
      },
      required: ["selector", "text"],
    },
  },
  classifyRisk: () => "review",
  describe: (args) => `Type into ${args.selector}`,
  run: async (args): Promise<ToolResult> => {
    const p = await getPage();
    await p
      .locator(String(args.selector))
      .first()
      .fill(String(args.text ?? ""), { timeout: 10_000 });
    return { ok: true, output: `Typed into ${args.selector}` };
  },
});

toolRegistry.register({
  spec: {
    name: "browser_extract_text",
    description:
      "Read the visible text of the current page, or of one element if a CSS selector is given.",
    parameters: {
      type: "object",
      properties: {
        selector: { type: "string", description: "Optional CSS selector to scope extraction." },
      },
    },
  },
  classifyRisk: () => "safe",
  describe: (args) => (args.selector ? `Extract text from ${args.selector}` : "Extract page text"),
  run: async (args): Promise<ToolResult> => {
    const p = await getPage();
    const text = args.selector
      ? (await p.locator(String(args.selector)).first().innerText({ timeout: 10_000 })) ?? ""
      : await extractVisibleText(p);
    return { ok: true, output: text.slice(0, 8000) };
  },
});

toolRegistry.register({
  spec: {
    name: "browser_screenshot",
    description: "Save a PNG screenshot of the current page to a file within the workspace.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Relative path to save the PNG to, e.g. 'screenshots/page.png'.",
        },
      },
      required: ["path"],
    },
  },
  classifyRisk: () => "review",
  describe: (args) => `Save screenshot to ${args.path}`,
  run: async (args, ctx: ToolContext): Promise<ToolResult> => {
    const { resolved } = resolveSafePath(String(args.path), ctx.workspaceRoot);
    await fsp.mkdir(path.dirname(resolved), { recursive: true });
    const p = await getPage();
    await p.screenshot({ path: resolved });
    return { ok: true, output: `Saved screenshot to ${resolved}` };
  },
});

toolRegistry.register({
  spec: {
    name: "browser_close",
    description: "Close the browser session and release resources. Safe to call even if no session is open.",
    parameters: { type: "object", properties: {} },
  },
  classifyRisk: () => "safe",
  describe: () => "Close browser session",
  run: async (): Promise<ToolResult> => {
    await closeBrowser();
    return { ok: true, output: "Browser closed." };
  },
});
