import { chromium, Browser, Page } from 'playwright';
import crypto from 'crypto';

interface CacheEntry {
  data: string;
  timestamp: number;
  accessCount: number;
}

interface ScreenshotOptions {
  width?: number;
  height?: number;
  quality?: number;
  waitTime?: number;
}

export class AdScreenshotService {
  private cache = new Map<string, CacheEntry>();
  private readonly CACHE_TTL = 30 * 60 * 1000; // 30 minutos
  private readonly MAX_CACHE_SIZE = 100; // Máximo 100 screenshots en cache
  private readonly CLEANUP_INTERVAL = 10 * 60 * 1000; // Limpieza cada 10 minutos
  
  constructor() {
    // Iniciar limpieza automática del cache
    this.startCacheCleanup();
  }

  /**
   * Genera screenshot de un anuncio de Facebook
   */
  async getAdScreenshot(
    adUrl: string, 
    adId: string, 
    options: ScreenshotOptions = {}
  ): Promise<{ success: boolean; data?: string; error?: string; cached?: boolean }> {
    const {
      width = 1200,
      height = 1600,  // Más alto para capturar anuncios completos
      quality = 65,
      waitTime = 4000  // Más tiempo para cargar
    } = options;

    // Generar clave de cache basada en URL y parámetros
    const cacheKey = this.generateCacheKey(adUrl, { width, height, quality });
    
    // Verificar cache
    const cachedEntry = this.cache.get(cacheKey);
    if (cachedEntry && this.isCacheValid(cachedEntry)) {
      // Actualizar estadísticas de acceso
      cachedEntry.accessCount++;
      return { 
        success: true, 
        data: cachedEntry.data, 
        cached: true 
      };
    }

    let browser: Browser | null = null;
    let page: Page | null = null;

    try {
      console.log(`🔍 Generando screenshot para ad ${adId}: ${adUrl}`);

      // Lanzar browser con configuración optimizada
      browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-first-run',
          '--no-default-browser-check',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding'
        ]
      });

      page = await browser.newPage();

      // Configurar viewport y user agent
      await page.setViewportSize({ width, height });
      await page.setExtraHTTPHeaders({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });

      // Navegar a la URL del anuncio
      await page.goto(adUrl, { 
        waitUntil: 'domcontentloaded',
        timeout: 15000 
      });

      // Esperar a que cargue el contenido
      await page.waitForTimeout(waitTime);

      // Intentar esperar elementos específicos de Facebook
      try {
        await page.waitForSelector('[role="main"], [data-pagelet="page"]', { 
          timeout: 5000 
        });
      } catch {
        // Si no encuentra elementos específicos, continúa
        console.log('⚠️ No se encontraron elementos específicos de Facebook, continuando...');
      }

      // Esperar a que se cargue completamente
      await page.waitForTimeout(waitTime);

      // Ocultar elementos innecesarios y optimizar para captura de anuncios
      await page.addStyleTag({
        content: `
          /* Ocultar elementos de navegación, sidebar y distracciones */
          [role="banner"], [role="navigation"], [role="complementary"],
          [aria-label="Chat"], [data-testid="cookie-policy-manage-dialog"],
          .fbChatSidebar, #pagelet_bluebar, ._5hn6, ._2s25, ._8i2e,
          [data-testid="cookie-policy-banner"], [data-testid="cookie-policy-dialog"],
          header, nav, .fb_dialog, .rightCol, ._1vc-, ._4_j4, .ego_column,
          [data-testid="left_nav_menu_list"], [data-testid="Sidebar"],
          .fbTimelineRightColumn, .fbTimelineTwoColumns .rightColumn,
          .fbTimelineUnit, .fbTimelineOneColumn,
          ._4-u3, ._5pcb, ._50f7, ._4-u8, .fbChatSidebar,
          .uiLikePageButton, .fbTimelineCapsule,
          div[data-testid="ChatTabHeader"], 
          div[aria-label="Messenger"], div[aria-label="Chat"] {
            display: none !important;
            visibility: hidden !important;
          }
          
          /* Reset and center body */
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #f0f2f5 !important;
            font-family: Helvetica, Arial, sans-serif !important;
            overflow-x: hidden !important;
          }
          
          /* Focus on main content area */
          #content, [role="main"], .fbTimelineUnit, .userContentWrapper,
          [data-testid="ad-preview"], [role="article"], ._4-u2, .fbUserContent {
            margin: 10px auto !important;
            margin-top: 30px !important;
            max-width: 460px !important;
            background: white !important;
            border-radius: 8px !important;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1) !important;
            padding: 16px !important;
            border: 1px solid #dadde1 !important;
            position: relative !important;
            top: 20px !important;
          }
          
          /* Ensure ad content is visible and properly sized */
          ._4-u2 .userContent, .fbUserContent, 
          [data-testid="post_message"], .userContent {
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 12px 0 !important;
          }
          
          /* Ad media and images */
          ._4-u2 img, .fbUserContent img, .scaledImageFitWidth img,
          [data-testid="ad-preview"] img, ._6ks img {
            max-width: 100% !important;
            height: auto !important;
            border-radius: 8px !important;
            margin: 8px 0 !important;
          }
          
          /* Ad text content */
          ._5pbx, .userContent, [data-testid="post_message"] {
            font-size: 14px !important;
            line-height: 1.38 !important;
            color: #1c1e21 !important;
            margin: 12px 0 !important;
          }
          
          /* CTA buttons and interaction elements */
          ._4jy0, .pluginButton, ._42ft, ._4jy2, .uiButton {
            margin: 12px 0 !important;
            border-radius: 6px !important;
          }
          
          /* Page info and branding */
          ._6a, ._6b, .fwb, .profileLink {
            font-weight: 600 !important;
            color: #385898 !important;
            text-decoration: none !important;
          }
          
          /* Timestamps and metadata */
          ._5pcp, ._5pcq, .timestampContent, .fsm {
            color: #65676b !important;
            font-size: 12px !important;
            margin: 4px 0 !important;
          }
          
          /* Remove scrollbars */
          * {
            scrollbar-width: none !important;
            -ms-overflow-style: none !important;
          }
          *::-webkit-scrollbar {
            display: none !important;
          }
          
          /* Make sure content doesn't overflow */
          * {
            box-sizing: border-box !important;
          }
          
          /* Hide floating elements and overlays */
          .uiContextualLayerPositioner, .uiLayer, ._5v-0, ._10w,
          .tooltipX, .uiTooltipX, ._3oh-, ._5lwe, ._5v-0 {
            display: none !important;
          }
        `
      });

      // Usar dimensiones centradas optimizadas para anuncios de Facebook
      const adBounds = {
        x: Math.max(0, (width - 500) / 2),
        y: 120,  // Mover hacia abajo para evitar espacio en blanco arriba
        width: Math.min(500, width - 40),
        height: Math.min(700, height - 120)  // Reducir altura para compensar
      };

      console.log(`📐 Usando dimensiones optimizadas para ad ${adId}:`, adBounds);

      // Tomar screenshot del área centrada
      const screenshot = await page.screenshot({
        type: 'jpeg',
        quality,
        fullPage: false,
        clip: adBounds
      });

      // Convertir a base64
      const base64Image = `data:image/jpeg;base64,${screenshot.toString('base64')}`;

      // Guardar en cache
      this.addToCache(cacheKey, base64Image);

      console.log(`✅ Screenshot generado exitosamente para ad ${adId} (${Math.round(base64Image.length / 1024)}KB)`);

      return {
        success: true,
        data: base64Image,
        cached: false
      };

    } catch (error) {
      console.error(`❌ Error generando screenshot para ad ${adId}:`, error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido'
      };
    } finally {
      // Limpiar recursos
      if (page) {
        try {
          await page.close();
        } catch (e) {
          console.error('Error cerrando página:', e);
        }
      }
      if (browser) {
        try {
          await browser.close();
        } catch (e) {
          console.error('Error cerrando browser:', e);
        }
      }
    }
  }

  /**
   * Genera una clave de cache única basada en URL y opciones
   */
  private generateCacheKey(url: string, options: any): string {
    const dataToHash = `${url}_${JSON.stringify(options)}`;
    return crypto.createHash('md5').update(dataToHash).digest('hex');
  }

  /**
   * Verifica si una entrada de cache sigue siendo válida
   */
  private isCacheValid(entry: CacheEntry): boolean {
    const now = Date.now();
    return (now - entry.timestamp) < this.CACHE_TTL;
  }

  /**
   * Añade una entrada al cache con gestión de tamaño
   */
  private addToCache(key: string, data: string): void {
    // Si el cache está lleno, eliminar las entradas menos usadas
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      this.evictLeastUsed();
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      accessCount: 1
    });
  }

  /**
   * Elimina las entradas menos usadas del cache
   */
  private evictLeastUsed(): void {
    let leastUsedKey = '';
    let leastUsedCount = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.accessCount < leastUsedCount) {
        leastUsedCount = entry.accessCount;
        leastUsedKey = key;
      }
    }

    if (leastUsedKey) {
      this.cache.delete(leastUsedKey);
      console.log(`🗑️ Entrada de cache eliminada: ${leastUsedKey}`);
    }
  }

  /**
   * Inicia la limpieza automática del cache
   */
  private startCacheCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      let removedCount = 0;

      for (const [key, entry] of this.cache.entries()) {
        if ((now - entry.timestamp) > this.CACHE_TTL) {
          this.cache.delete(key);
          removedCount++;
        }
      }

      if (removedCount > 0) {
        console.log(`🧹 Cache cleanup: ${removedCount} entradas eliminadas. Cache actual: ${this.cache.size} entradas`);
      }
    }, this.CLEANUP_INTERVAL);
  }

  /**
   * Obtiene estadísticas del cache
   */
  getCacheStats(): {
    size: number;
    maxSize: number;
    entries: Array<{ key: string; timestamp: number; accessCount: number; age: number }>;
  } {
    const now = Date.now();
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key: key.substring(0, 8) + '...',
      timestamp: entry.timestamp,
      accessCount: entry.accessCount,
      age: Math.round((now - entry.timestamp) / 1000 / 60) // edad en minutos
    }));

    return {
      size: this.cache.size,
      maxSize: this.MAX_CACHE_SIZE,
      entries
    };
  }

  /**
   * Limpia todo el cache
   */
  clearCache(): void {
    this.cache.clear();
    console.log('🗑️ Cache de screenshots limpiado completamente');
  }
}
