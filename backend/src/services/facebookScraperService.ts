import { chromium, Browser, Page } from 'playwright'
import type { AdData } from '@shared/types'

export interface ScrapingOptions {
  advertiserName: string
  maxAds?: number
  country?: string
  useStealth?: boolean
}

export interface ScrapingResult {
  success: boolean
  data: AdData[]
  totalFound: number
  error?: string
  executionTime: number
}

export class FacebookScraperService {
  private browser: Browser | null = null

  async scrapeAdvertiserAds(options: ScrapingOptions): Promise<ScrapingResult> {
    const startTime = Date.now()
    
    try {
      console.log(`🚀 Starting scraping for advertiser: ${options.advertiserName}`)
      
      // Launch browser with stealth options
      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--disable-features=TranslateUI',
          '--disable-ipc-flooding-protection',
        ]
      })

      const context = await this.browser.newContext({
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        locale: 'en-US',
        timezoneId: 'America/New_York',
      })

      const page = await context.newPage()

      // Set up stealth measures
      await this.setupStealth(page)

      // Navigate to Facebook Ad Library
      const adLibraryUrl = this.buildAdLibraryUrl(options)
      console.log(`📱 Navigating to: ${adLibraryUrl}`)
      
      await page.goto(adLibraryUrl, { 
        waitUntil: 'networkidle',
        timeout: 30000 
      })

      // Wait for content to load
      await page.waitForTimeout(3000)

      // Extract ads data
      const adsData = await this.extractAdsData(page, options)

      const executionTime = Date.now() - startTime
      console.log(`✅ Scraping completed in ${executionTime}ms. Found ${adsData.length} ads`)

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

      return {
        success: true,
        data: adsData,
        totalFound: adsData.length,
        executionTime,
        debug: {
          url: adLibraryUrl,
          finalUrl: currentUrl,
          advertiserName: options.advertiserName,
          country: options.country,
          maxAds: options.maxAds,
          extractedAt: new Date().toISOString(),
          pageTitle,
          adsFound: adsData.length,
          pageDebug: debugInfo,
          pageContentLength: pageContent.length
        }
      }

    } catch (error) {
      const executionTime = Date.now() - startTime
      console.error('❌ Scraping failed:', error)
      
      return {
        success: false,
        data: [],
        totalFound: 0,
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

  private async setupStealth(page: Page): Promise<void> {
    // Override navigator properties
    await page.addInitScript(() => {
      // Remove webdriver property
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      })

      // Mock plugins
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      })

      // Mock languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      })

      // Mock permissions
      const originalQuery = window.navigator.permissions.query
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission }) :
          originalQuery(parameters)
      )
    })

    // Set extra headers
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      'Upgrade-Insecure-Requests': '1',
      'Cache-Control': 'max-age=0',
    })
  }

  private buildAdLibraryUrl(options: ScrapingOptions): string {
    const baseUrl = 'https://www.facebook.com/ads/library/'
    const params = new URLSearchParams({
      active_status: 'active',
      ad_type: 'all',
      country: options.country || 'CO',
      search_type: 'advertiser',
      q: options.advertiserName,
    })

    return `${baseUrl}?${params.toString()}`
  }

  private async extractAdsData(page: Page, options: ScrapingOptions): Promise<AdData[]> {
    const ads: AdData[] = []
    let attempts = 0
    const maxAttempts = 10

    while (attempts < maxAttempts) {
      try {
        // Wait for ads to load
        await page.waitForTimeout(2000)

        // Extract ads from current page
        const pageAds = await page.evaluate(() => {
          const ads: any[] = []
          
          // Look for ad containers (this selector may need adjustment based on Facebook's current structure)
          const adElements = document.querySelectorAll('[data-testid="ad-card"], .ad-card, [role="article"]')
          
          adElements.forEach((element, index) => {
            try {
              // Extract advertiser name
              const advertiserElement = element.querySelector('[data-testid="advertiser-name"], .advertiser-name, h3, h4')
              const advertiserName = advertiserElement?.textContent?.trim() || 'Unknown Advertiser'

              // Extract ad text
              const textElement = element.querySelector('[data-testid="ad-text"], .ad-text, p')
              const adText = textElement?.textContent?.trim() || ''

              // Extract images
              const imageElements = element.querySelectorAll('img')
              const images = Array.from(imageElements).map(img => ({
                src: img.src,
                alt: img.alt || ''
              })).filter(img => img.src && !img.src.includes('data:'))

              // Extract video elements
              const videoElements = element.querySelectorAll('video')
              const videos = Array.from(videoElements).map(video => ({
                src: video.src || '',
                poster: video.poster || ''
              })).filter(video => video.src)

              // Extract link
              const linkElement = element.querySelector('a[href*="facebook.com"]')
              const link = linkElement?.getAttribute('href') || ''

              if (advertiserName && (adText || images.length > 0 || videos.length > 0)) {
                ads.push({
                  id: `scraped_${Date.now()}_${index}`,
                  page_name: advertiserName,
                  ad_creative_bodies: adText ? [adText] : [],
                  ad_delivery_start_time: new Date().toISOString(),
                  days_running: Math.floor(Math.random() * 30) + 1, // Mock data
                  hotness_score: Math.floor(Math.random() * 5) + 1,
                  collation_count: 1,
                  source: 'facebook_scraping',
                  images: images,
                  videos: videos,
                  link: link,
                  scraped_at: new Date().toISOString()
                })
              }
            } catch (error) {
              console.error('Error extracting ad data:', error)
            }
          })

          return ads
        })

        ads.push(...pageAds)
        console.log(`📊 Found ${pageAds.length} ads on page ${attempts + 1}`)

        // Check if we should stop
        if (pageAds.length === 0 || ads.length >= (options.maxAds || 50)) {
          break
        }

        // Try to load more ads (scroll or click "Show more")
        try {
          // Scroll to bottom to trigger lazy loading
          await page.evaluate(() => {
            window.scrollTo(0, document.body.scrollHeight)
          })

          // Look for "Show more" button
          const showMoreButton = await page.$('[data-testid="show-more"], button:has-text("Show more"), button:has-text("Ver más")')
          if (showMoreButton) {
            await showMoreButton.click()
            await page.waitForTimeout(3000)
          }
        } catch (error) {
          console.log('Could not load more ads, continuing...')
        }

        attempts++
      } catch (error) {
        console.error(`Error on attempt ${attempts + 1}:`, error)
        attempts++
        await page.waitForTimeout(2000)
      }
    }

    return ads.slice(0, options.maxAds || 50)
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close()
      this.browser = null
    }
  }
}
