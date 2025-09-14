import { chromium, Browser, Page } from 'playwright'

export interface AdvertiserStats {
  pageId: string
  advertiserName?: string
  totalActiveAds: number
  lastUpdated: string
}

export interface AdvertiserStatsResult {
  success: boolean
  stats?: AdvertiserStats
  error?: string
  executionTime: number
}

export class AdvertiserStatsService {
  private browser: Browser | null = null
  private cache = new Map<string, AdvertiserStats>()
  private readonly CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

  async getAdvertiserStats(pageId: string, country: string = 'ALL'): Promise<AdvertiserStatsResult> {
    const startTime = Date.now()
    
    try {
      // Check cache first
      const cached = this.getCachedStats(pageId)
      if (cached) {
        console.log(`📊 Using cached stats for pageId ${pageId}: ${cached.totalActiveAds} ads`)
        return {
          success: true,
          stats: cached,
          executionTime: Date.now() - startTime,
          debug: {
            url: this.buildAdLibraryUrl(pageId, country),
            pageId,
            country,
            extractedAt: new Date().toISOString(),
            cacheHit: true,
            cacheAge: Date.now() - new Date(cached.lastUpdated).getTime()
          }
        }
      }

      console.log(`🔍 Getting stats for pageId: ${pageId}`)
      
      // Launch browser with EXACT same config as working test-direct-url endpoint
      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ]
      })

      const context = await this.browser.newContext({
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      })

      const page = await context.newPage()

      // NO stealth measures - they might be causing detection

      // Navigate to Facebook Ad Library
      const adLibraryUrl = this.buildAdLibraryUrl(pageId, country)
      console.log(`📱 Navigating to: ${adLibraryUrl}`)
      
      await page.goto(adLibraryUrl, { 
        waitUntil: 'networkidle',
        timeout: 30000 
      })

      // Wait for content to load (same as working endpoint)
      await page.waitForTimeout(5000)

      // Extract total count and advertiser name
      const { totalCount, advertiserName } = await this.extractStatsFromPage(page)

      // Get page content for debug
      const pageContent = await page.content()
      const pageTitle = await page.title()
      const currentUrl = page.url()

      // Get more detailed debug info
      const debugInfo = await page.evaluate(() => {
        const adElements = document.querySelectorAll('[data-testid="ad-card"], .ad-card, [role="article"]')
        const countElements = document.querySelectorAll('[data-testid="results-count"], .results-count, [role="status"]')
        
        return {
          visibleAds: adElements.length,
          countElements: Array.from(countElements).map(el => el.textContent),
          pageText: document.body.innerText.substring(0, 1000), // First 1000 chars
          hasResults: document.body.innerText.toLowerCase().includes('results') || 
                     document.body.innerText.toLowerCase().includes('anuncios') ||
                     document.body.innerText.toLowerCase().includes('ads'),
          hasNoResults: document.body.innerText.toLowerCase().includes('no results') ||
                       document.body.innerText.toLowerCase().includes('no se encontraron') ||
                       document.body.innerText.toLowerCase().includes('sin resultados')
        }
      })

      const stats: AdvertiserStats = {
        pageId,
        advertiserName,
        totalActiveAds: totalCount,
        lastUpdated: new Date().toISOString()
      }

      // Cache the result
      this.cache.set(pageId, stats)

      const executionTime = Date.now() - startTime
      console.log(`✅ Stats extraction completed in ${executionTime}ms. Found ${totalCount} total ads for ${advertiserName || pageId}`)

      return {
        success: true,
        stats,
        executionTime,
        debug: {
          url: adLibraryUrl,
          finalUrl: currentUrl,
          pageId,
          advertiserName,
          country,
          extractedAt: new Date().toISOString(),
          cacheHit: false,
          pageTitle,
          totalCount,
          pageDebug: debugInfo,
          pageContentLength: pageContent.length
        }
      }

    } catch (error) {
      const executionTime = Date.now() - startTime
      console.error('❌ Stats extraction failed:', error)
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime
      }
    } finally {
      if (this.browser) {
        await this.browser.close()
        this.browser = null
      }
    }
  }

  private getCachedStats(pageId: string): AdvertiserStats | null {
    const cached = this.cache.get(pageId)
    if (!cached) return null

    const now = Date.now()
    const cacheTime = new Date(cached.lastUpdated).getTime()
    
    if (now - cacheTime > this.CACHE_DURATION) {
      this.cache.delete(pageId)
      return null
    }

    return cached
  }

  private async setupStealth(page: Page): Promise<void> {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      })

      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      })

      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      })
    })

    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      'Upgrade-Insecure-Requests': '1',
    })
  }

  private buildAdLibraryUrl(pageId: string, country: string = 'ALL'): string {
    const baseUrl = 'https://www.facebook.com/ads/library/'
    
    const params = new URLSearchParams({
      active_status: 'active',
      ad_type: 'all',
      country: country,
      is_targeted_country: 'false',
      media_type: 'all',
      search_type: 'page',
      view_all_page_id: pageId,
    })

    return `${baseUrl}?${params.toString()}`
  }

  private async extractStatsFromPage(page: Page): Promise<{ totalCount: number; advertiserName?: string }> {
    try {
      // Wait for content to load (same as working endpoint)
      await page.waitForTimeout(5000)

      // Get page content for analysis
      const pageContent = await page.content()
      console.log(`📄 Page content length: ${pageContent.length} characters`)

      // Extract advertiser name and total count using the SAME logic as the working test-direct-url endpoint
      const pageData = await page.evaluate(() => {
        const text = document.body.innerText;
        
        // Extract advertiser name - look for page name in the sidebar
        let advertiserName = null;
        const nameSelectors = [
          'h1',
          'h2', 
          '[data-testid="page-name"]',
          '.page-name',
          '[class*="page"]',
          '[class*="name"]'
        ];
        
        for (const selector of nameSelectors) {
          const elements = document.querySelectorAll(selector);
          for (const element of elements) {
            const elementText = element.textContent?.trim();
            if (elementText && elementText.length > 0 && elementText.length < 100) {
              // Skip common UI text
              if (!elementText.toLowerCase().includes('anuncios') && 
                  !elementText.toLowerCase().includes('ads') &&
                  !elementText.toLowerCase().includes('biblioteca') &&
                  !elementText.toLowerCase().includes('library')) {
                advertiserName = elementText;
                break;
              }
            }
          }
          if (advertiserName) break;
        }
        
        // Extract total count - use EXACT same logic as working test-direct-url endpoint
        let totalCount = 0;
        
        // Look for the specific Facebook pattern "~X.XXX resultados" (EXACT same regex)
        const tildePattern = text.match(/~(\d{1,3}(?:\.\d{3})*)\s*resultados?/i);
        if (tildePattern) {
          totalCount = parseInt(tildePattern[1].replace(/\./g, ''));
          console.log(`📊 Found tilde pattern: ${tildePattern[0]} -> ${totalCount}`);
        } else {
          // Look for "X.XXX resultados" pattern (without tilde) (EXACT same regex)
          const resultadosPattern = text.match(/(\d{1,3}(?:\.\d{3})*)\s*resultados?/i);
          if (resultadosPattern) {
            totalCount = parseInt(resultadosPattern[1].replace(/\./g, ''));
            console.log(`📊 Found resultados pattern: ${resultadosPattern[0]} -> ${totalCount}`);
          }
        }
        
        // Debug: log the text we're searching in
        console.log(`📄 Searching in text (first 500 chars): ${text.substring(0, 500)}`);
        
        return { advertiserName, totalCount };
      });

      console.log(`📊 Found ${pageData.totalCount} total ads for ${pageData.advertiserName || 'unknown advertiser'}`);
      return pageData;

    } catch (error) {
      console.error('Error extracting stats from page:', error);
      return { totalCount: 0 };
    }
  }

  private async extractTotalCount(page: Page): Promise<number> {
    try {
      // Wait a bit more for content to load
      await page.waitForTimeout(5000)

      // Get page content for analysis
      const pageContent = await page.content()
      console.log(`📄 Page content length: ${pageContent.length} characters`)

      // Look for total count indicators in the page with more comprehensive selectors
      const countSelectors = [
        '[data-testid="results-count"]',
        '.results-count',
        '[role="status"]',
        'h2:contains("results")',
        'span:contains("results")',
        'div:contains("results")',
        'div:contains("anuncios")',
        'div:contains("ads")',
        'span:contains("anuncios")',
        'span:contains("ads")',
        // Facebook specific selectors for the sidebar count
        'span:contains("resultados")',
        'div:contains("resultados")',
        'span:contains("~")',
        'div:contains("~")',
        // Facebook specific selectors
        '[aria-label*="results"]',
        '[aria-label*="anuncios"]',
        '[aria-label*="ads"]',
        // Look for pagination or count indicators
        'div[class*="count"]',
        'span[class*="count"]',
        'div[class*="total"]',
        'span[class*="total"]'
      ]

      for (const selector of countSelectors) {
        try {
          const elements = await page.$$(selector)
          for (const element of elements) {
            const text = await element.textContent()
            if (text) {
              console.log(`🔍 Checking text: "${text}" from selector: ${selector}`)
              
              // Look for the specific Facebook pattern "~X.XXX resultados"
              const tildePattern = text.match(/~(\d{1,3}(?:\.\d{3})*)\s*resultados?/i)
              if (tildePattern) {
                const count = parseInt(tildePattern[1].replace(/\./g, ''))
                console.log(`📊 Found tilde pattern count: ${count} from text: "${text}"`)
                return count
              }
              
              // Look for "X.XXX resultados" pattern (without tilde)
              const resultadosPattern = text.match(/(\d{1,3}(?:\.\d{3})*)\s*resultados?/i)
              if (resultadosPattern) {
                const count = parseInt(resultadosPattern[1].replace(/\./g, ''))
                console.log(`📊 Found resultados pattern count: ${count} from text: "${text}"`)
                return count
              }
              
              // Extract number from text like "1,234 results" or "Showing 1-20 of 1,234"
              const numbers = text.match(/(\d{1,3}(?:,\d{3})*)/g)
              if (numbers && numbers.length > 0) {
                // Take the largest number found (usually the total)
                const maxNumber = Math.max(...numbers.map(n => parseInt(n.replace(/,/g, ''))))
                if (maxNumber > 0) {
                  console.log(`📊 Found total count: ${maxNumber} from text: "${text}"`)
                  return maxNumber
                }
              }
            }
          }
        } catch (error) {
          // Continue to next selector
        }
      }

      // Try to find ads using more specific Facebook selectors
      const visibleAds = await page.evaluate(() => {
        // Facebook Ad Library specific selectors
        const adSelectors = [
          '[data-testid="ad-card"]',
          '.ad-card',
          '[role="article"]',
          'div[class*="ad"]',
          'div[class*="card"]',
          'div[class*="result"]',
          // More specific Facebook selectors
          'div[data-pagelet="AdCard"]',
          'div[data-pagelet*="Ad"]',
          'div[class*="x1yztbdb"]', // Common Facebook class pattern
          'div[class*="x1n2onr6"]', // Another common Facebook class pattern
          'div[class*="x9f619"]',   // Another common Facebook class pattern
        ]
        
        let totalAds = 0
        for (const selector of adSelectors) {
          const elements = document.querySelectorAll(selector)
          if (elements.length > 0) {
            console.log(`Found ${elements.length} elements with selector: ${selector}`)
            totalAds = Math.max(totalAds, elements.length)
          }
        }
        
        return totalAds
      })

      console.log(`📊 Found ${visibleAds} visible ads on page`)

      // If we see ads, estimate total (Facebook typically shows 20-50 per page)
      if (visibleAds > 0) {
        const estimatedTotal = Math.max(visibleAds * 10, visibleAds + 50) // Conservative estimate
        console.log(`📊 Estimated total count: ${estimatedTotal} (based on ${visibleAds} visible ads)`)
        return estimatedTotal
      }

      // Try to detect if page shows "no results" message
      const noResultsDetected = await page.evaluate(() => {
        const text = document.body.innerText.toLowerCase()
        return text.includes('no results') || 
               text.includes('sin resultados') || 
               text.includes('no se encontraron') ||
               text.includes('no ads found') ||
               text.includes('no anuncios encontrados')
      })

      if (noResultsDetected) {
        console.log('📊 No results message detected, returning 0')
        return 0
      }

      console.log('📊 No ads found and no no-results message, returning 0')
      return 0

    } catch (error) {
      console.error('Error extracting total count:', error)
      return 0
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close()
      this.browser = null
    }
  }

  // Clear cache method for manual cache management
  clearCache(pageId?: string): void {
    if (pageId) {
      this.cache.delete(pageId)
    } else {
      this.cache.clear()
    }
  }
}
