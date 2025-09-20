import { chromium, Browser, BrowserContext, Page } from 'playwright';

interface BrowserInstance {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  inUse: boolean;
  lastUsed: Date;
  createdAt: Date;
}

interface BrowserPoolOptions {
  maxBrowsers?: number;
  maxIdleTime?: number; // milliseconds
  maxLifeTime?: number; // milliseconds
}

export class BrowserPool {
  private browsers: BrowserInstance[] = [];
  private maxBrowsers: number;
  private maxIdleTime: number;
  private maxLifeTime: number;
  private cleanupInterval: NodeJS.Timeout;

  constructor(options: BrowserPoolOptions = {}) {
    this.maxBrowsers = options.maxBrowsers || 5;
    this.maxIdleTime = options.maxIdleTime || 5 * 60 * 1000; // 5 minutes
    this.maxLifeTime = options.maxLifeTime || 30 * 60 * 1000; // 30 minutes

    // Cleanup old browsers every 2 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 2 * 60 * 1000);

    console.log(`🎭 Browser pool initialized with max ${this.maxBrowsers} browsers`);
  }

  async getBrowser(): Promise<BrowserInstance> {
    // Try to find an available browser
    let availableBrowser = this.browsers.find(b => !b.inUse);

    if (availableBrowser) {
      // Check if browser is still alive
      try {
        await availableBrowser.page.evaluate(() => true);
        availableBrowser.inUse = true;
        availableBrowser.lastUsed = new Date();
        console.log(`🎭 Reusing existing browser (${this.browsers.length}/${this.maxBrowsers} in pool)`);
        return availableBrowser;
      } catch (error) {
        // Browser is dead, remove it
        console.log('🎭 Removing dead browser from pool');
        await this.removeBrowser(availableBrowser);
        availableBrowser = undefined;
      }
    }

    // Create new browser if we haven't reached the limit
    if (this.browsers.length < this.maxBrowsers) {
      const browserInstance = await this.createBrowser();
      this.browsers.push(browserInstance);
      console.log(`🎭 Created new browser (${this.browsers.length}/${this.maxBrowsers} in pool)`);
      return browserInstance;
    }

    // Pool is full, wait for an available browser
    console.log('🎭 Browser pool full, waiting for available browser...');
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        const available = this.browsers.find(b => !b.inUse);
        if (available) {
          clearInterval(checkInterval);
          available.inUse = true;
          available.lastUsed = new Date();
          resolve(available);
        }
      }, 100);

      // Timeout after 30 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        reject(new Error('Timeout waiting for available browser'));
      }, 30000);
    });
  }

  async releaseBrowser(browserInstance: BrowserInstance): Promise<void> {
    const index = this.browsers.findIndex(b => b === browserInstance);
    if (index !== -1) {
      browserInstance.inUse = false;
      browserInstance.lastUsed = new Date();
      console.log(`🎭 Released browser back to pool`);
    }
  }

  private async createBrowser(): Promise<BrowserInstance> {
    const browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--memory-pressure-off',
        '--max_old_space_size=2048', // Reduced from 4096
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-extensions',
        '--disable-plugins',
        '--disable-images', // Disable image loading to save memory
        '--aggressive-cache-discard',
        '--memory-pressure-off'
      ]
    });

    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ignoreHTTPSErrors: true,
    });

    const page = await context.newPage();

    // Set reasonable timeouts
    page.setDefaultTimeout(30000);
    page.setDefaultNavigationTimeout(30000);

    const browserInstance: BrowserInstance = {
      browser,
      context,
      page,
      inUse: true,
      lastUsed: new Date(),
      createdAt: new Date()
    };

    return browserInstance;
  }

  private async removeBrowser(browserInstance: BrowserInstance): Promise<void> {
    const index = this.browsers.findIndex(b => b === browserInstance);
    if (index !== -1) {
      try {
        await browserInstance.context.close();
        await browserInstance.browser.close();
      } catch (error) {
        console.error('Error closing browser:', error);
      }
      this.browsers.splice(index, 1);
      console.log(`🎭 Removed browser from pool (${this.browsers.length}/${this.maxBrowsers} remaining)`);
    }
  }

  private async cleanup(): Promise<void> {
    const now = new Date();
    const browsersToRemove: BrowserInstance[] = [];

    for (const browserInstance of this.browsers) {
      if (browserInstance.inUse) continue;

      const idleTime = now.getTime() - browserInstance.lastUsed.getTime();
      const lifeTime = now.getTime() - browserInstance.createdAt.getTime();

      // Remove if idle too long or lived too long
      if (idleTime > this.maxIdleTime || lifeTime > this.maxLifeTime) {
        browsersToRemove.push(browserInstance);
      }
    }

    for (const browserInstance of browsersToRemove) {
      await this.removeBrowser(browserInstance);
    }

    if (browsersToRemove.length > 0) {
      console.log(`🎭 Cleaned up ${browsersToRemove.length} old browsers`);
    }
  }

  async closeAll(): Promise<void> {
    clearInterval(this.cleanupInterval);
    
    const closePromises = this.browsers.map(async (browserInstance) => {
      try {
        await browserInstance.context.close();
        await browserInstance.browser.close();
      } catch (error) {
        console.error('Error closing browser during cleanup:', error);
      }
    });

    await Promise.all(closePromises);
    this.browsers = [];
    console.log('🎭 All browsers closed');
  }

  getStats() {
    const inUse = this.browsers.filter(b => b.inUse).length;
    const available = this.browsers.length - inUse;
    
    return {
      total: this.browsers.length,
      inUse,
      available,
      maxBrowsers: this.maxBrowsers
    };
  }
}

// Global browser pool instance
export const browserPool = new BrowserPool({
  maxBrowsers: 2, // More conservative for production
  maxIdleTime: 2 * 60 * 1000, // 2 minutes - more aggressive cleanup
  maxLifeTime: 10 * 60 * 1000 // 10 minutes - shorter lifetime
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🎭 Closing browser pool...');
  await browserPool.closeAll();
});

process.on('SIGINT', async () => {
  console.log('🎭 Closing browser pool...');
  await browserPool.closeAll();
  process.exit(0);
});
