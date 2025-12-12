import puppeteer from "puppeteer";

interface ContextResult {
  ok: boolean;
  text: string;
  source: string;
  target: string;
  translations: string[];
  examples: {
    id: number;
    source: string;
    target: string;
  }[];
}

interface ErrorResult {
  ok: false;
  message: string;
}

export class ReversoWrapper {
  private browser: any = null;

  async init() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-blink-features=AutomationControlled",
        ],
      });
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async getContext(
    text: string,
    source: string = "english",
    target: string = "russian"
  ): Promise<ContextResult | ErrorResult> {
    try {
      await this.init();

      const page = await this.browser.newPage();

      // Set user agent to avoid detection
      await page.setUserAgent(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      );

      // Set extra headers
      await page.setExtraHTTPHeaders({
        "Accept-Language": "en-US,en;q=0.9",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      });

      const url = `https://context.reverso.net/translation/${source}-${target}/${encodeURIComponent(
        text
      ).replace(/%20/g, "+")}`;

      console.log(`Fetching: ${url}`);

      // Navigate to the page
      await page.goto(url, {
        waitUntil: "networkidle2",
        timeout: 60000,
      });

      // Wait a bit more to ensure Cloudflare challenge is passed
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Check if we're still on a Cloudflare challenge page
      const title = await page.title();
      if (title.includes("Just a moment")) {
        // Wait longer for Cloudflare to complete
        await new Promise((resolve) => setTimeout(resolve, 10000));
      }

      // Extract translations
      const translations = await page.evaluate(() => {
        const elements = document.querySelectorAll(
          "#translations-content > div"
        );
        return Array.from(elements)
          .map((el) => el.textContent?.trim())
          .filter((text) => text && text.length > 0);
      });

      // Extract examples
      const examples = await page.evaluate(() => {
        const exampleElements = document.querySelectorAll(".example");
        return Array.from(exampleElements).map((example, index) => {
          const sourceEl = example.querySelector(".src .text");
          const targetEl = example.querySelector(".trg .text");
          return {
            id: index,
            source: sourceEl?.textContent?.trim() || "",
            target: targetEl?.textContent?.trim() || "",
          };
        });
      });

      await page.close();

      return {
        ok: true,
        text,
        source,
        target,
        translations,
        examples: examples.filter((ex) => ex.source && ex.target),
      };
    } catch (error: any) {
      return {
        ok: false,
        message: error.message || "An error occurred",
      };
    }
  }
}
