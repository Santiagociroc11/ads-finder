import { collections } from '@/services/database.js';
import { advertiserStatsService } from '@/services/advertiserStatsService.js';
import { telegramBotService } from '@/services/telegramBotService.js';
import { cronQueueService } from '@/services/cronQueue.js';
import { ObjectId } from 'mongodb';

interface DailyStatsUpdate {
  date: Date;
  activeAds: number;
  newAds: number;
  totalAds: number;
  change: number; // diferencia con el día anterior
  changePercentage: number;
}

interface AdvertiserAlert {
  type: 'growth' | 'decline' | 'inactive' | 'high_activity';
  message: string;
  severity: 'low' | 'medium' | 'high';
  changePercentage: number;
  previousAds: number;
  currentAds: number;
}

export class DailyAdvertiserMonitor {
  private isRunning = false;
  private lastRunDate: Date | null = null;

  /**
   * Ejecuta el monitoreo diario de todos los anunciantes trackeados
   */
  async runDailyMonitoring(): Promise<void> {
    if (this.isRunning) {
      console.log('📊 Daily monitoring already running, skipping...');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();
    
    try {
      console.log('🚀 Starting daily advertiser monitoring...');
      
      // Verificar que la base de datos esté lista
      if (!await this.isDatabaseReady()) {
        console.log('📊 Database not ready, skipping monitoring');
        return;
      }
      
      // Verificar si ya se ejecutó hoy
      if (this.hasRunToday()) {
        console.log('📊 Daily monitoring already completed today, skipping...');
        return;
      }

      // Obtener todos los anunciantes trackeados activos
      const trackedAdvertisers = await this.getActiveTrackedAdvertisers();
      console.log(`📊 Found ${trackedAdvertisers.length} active tracked advertisers`);

      if (trackedAdvertisers.length === 0) {
        console.log('📊 No active tracked advertisers found, skipping monitoring');
        return;
      }

      // Usar sistema de colas para procesamiento controlado
      console.log(`📊 Adding ${trackedAdvertisers.length} advertisers to queue for controlled processing...`);
      await cronQueueService.addAdvertisersToQueue(trackedAdvertisers);
      
      // Procesar la cola (con rate limiting de 2 segundos entre requests)
      const results = await cronQueueService.processQueue();
      
      console.log(`📊 Queue processing completed: ${results.length} advertisers processed`);
      
      // Marcar como ejecutado hoy
      this.lastRunDate = new Date();
      
      const executionTime = Date.now() - startTime;
      console.log(`✅ Daily monitoring completed in ${executionTime}ms`);
      console.log(`📊 Processed ${results.length} advertisers via queue system`);
      
    } catch (error) {
      console.error('❌ Error in daily advertiser monitoring:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Ejecuta monitoreo intermedio (cada 2 horas)
   */
  async runIntermediateMonitoring(): Promise<void> {
    console.log('🔄 Starting intermediate advertiser monitoring...');
    
    try {
      // Solo procesar anunciantes que han sido muy activos recientemente
      const activeAdvertisers = await this.getHighlyActiveAdvertisers();
      
      if (activeAdvertisers.length === 0) {
        console.log('🔄 No highly active advertisers found for intermediate monitoring');
        return;
      }

      console.log(`🔄 Found ${activeAdvertisers.length} highly active advertisers`);
      
      // Procesar en lotes más pequeños para monitoreo intermedio
      const results = await this.processAdvertisersBatch(activeAdvertisers.slice(0, 10)); // Solo los primeros 10
      
      console.log(`✅ Intermediate monitoring completed: ${results.length} advertisers processed`);
      
    } catch (error) {
      console.error('❌ Error in intermediate monitoring:', error);
    }
  }

  /**
   * Ejecuta monitoreo de fin de semana
   */
  async runWeekendMonitoring(): Promise<void> {
    console.log('📅 Starting weekend advertiser monitoring...');
    
    try {
      // Procesar todos los anunciantes activos en fin de semana
      const trackedAdvertisers = await this.getActiveTrackedAdvertisers();
      
      if (trackedAdvertisers.length === 0) {
        console.log('📅 No active tracked advertisers found for weekend monitoring');
        return;
      }

      console.log(`📅 Found ${trackedAdvertisers.length} advertisers for weekend monitoring`);
      
      // Procesar en lotes más grandes para fin de semana
      const results = await this.processAdvertisersBatch(trackedAdvertisers);
      
      console.log(`✅ Weekend monitoring completed: ${results.length} advertisers processed`);
      
    } catch (error) {
      console.error('❌ Error in weekend monitoring:', error);
    }
  }

  /**
   * Obtiene anunciantes altamente activos
   */
  private async getHighlyActiveAdvertisers(): Promise<any[]> {
    try {
      if (!collections.trackedAdvertisers) {
        return [];
      }

      // Buscar anunciantes con más de 5 anuncios activos en los últimos días
      const highlyActive = await collections.trackedAdvertisers.find({
        isActive: true,
        $expr: {
          $gt: [
            { $arrayElemAt: ['$dailyStats.activeAds', -1] },
            5
          ]
        }
      }).toArray();

      return highlyActive;
    } catch (error) {
      console.error('Error getting highly active advertisers:', error);
      return [];
    }
  }

  /**
   * Procesa un lote de anunciantes
   */
  private async processAdvertisersBatch(advertisers: any[]): Promise<any[]> {
    const results = [];
    
    for (const advertiser of advertisers) {
      try {
        const result = await this.processAdvertisers([advertiser]);
        if (result) {
          results.push(result);
        }
      } catch (error) {
        console.error(`Error processing advertiser ${advertiser.pageName}:`, error);
      }
    }
    
    return results;
  }

  /**
   * Verifica si la base de datos está lista
   */
  private async isDatabaseReady(): Promise<boolean> {
    try {
      // Verificar que las colecciones estén disponibles
      if (!collections.trackedAdvertisers || !collections.users) {
        return false;
      }

      // Hacer una consulta simple para verificar conectividad
      await collections.trackedAdvertisers.findOne({});
      return true;
    } catch (error) {
      console.log('📊 Database not ready:', error);
      return false;
    }
  }

  /**
   * Obtiene todos los anunciantes trackeados activos
   */
  private async getActiveTrackedAdvertisers(): Promise<any[]> {
    // Wait for database to be ready with retry logic
    let retries = 0;
    const maxRetries = 5;
    
    while (retries < maxRetries) {
      if (collections.trackedAdvertisers) {
        break;
      }
      
      console.log(`📊 Waiting for database initialization... (attempt ${retries + 1}/${maxRetries})`);
      await this.delay(2000); // Wait 2 seconds
      retries++;
    }

    if (!collections.trackedAdvertisers) {
      throw new Error('Database not initialized after maximum retries');
    }

    const advertisers = await collections.trackedAdvertisers
      .find({ isActive: true })
      .toArray();

    return advertisers;
  }

  /**
   * Procesa cada anunciante para obtener sus estadísticas actuales
   */
  private async processAdvertisers(advertisers: any[]): Promise<any[]> {
    const results = [];
    
    for (const advertiser of advertisers) {
      try {
        console.log(`📊 Processing advertiser: ${advertiser.pageName} (${advertiser.pageId})`);
        
        // Llamar al mismo endpoint que usa la SearchPage
        // NO pasar userId para que no se trackeen créditos (es proceso del sistema)
        const statsResult = await advertiserStatsService.getAdvertiserStats(
          advertiser.pageId,
          'ALL' // Usar 'ALL' como país por defecto
        );

        if (statsResult.success && statsResult.stats) {
          const currentActiveAds = statsResult.stats.totalActiveAds || 0;
          
          // Obtener estadísticas del día anterior
          const previousStats = this.getPreviousDayStats(advertiser.dailyStats);
          const previousActiveAds = previousStats?.activeAds || 0;
          
          // Calcular cambios
          const change = currentActiveAds - previousActiveAds;
          const changePercentage = previousActiveAds > 0 
            ? ((change / previousActiveAds) * 100) 
            : currentActiveAds > 0 ? 100 : 0;
          
          // Crear nueva entrada de estadísticas diarias
          const newDailyStat = {
            date: new Date(),
            activeAds: currentActiveAds,
            newAds: change > 0 ? change : 0,
            totalAds: advertiser.totalAdsTracked + (change > 0 ? change : 0),
            reachEstimate: undefined,
            avgSpend: undefined
          };

          // Actualizar el anunciante en la base de datos
          await this.updateAdvertiserStats(advertiser._id, newDailyStat, currentActiveAds);

          results.push({
            advertiser,
            currentActiveAds,
            previousActiveAds,
            change,
            changePercentage,
            newDailyStat
          });

          console.log(`✅ ${advertiser.pageName}: ${previousActiveAds} → ${currentActiveAds} (${change > 0 ? '+' : ''}${change})`);
          
          // Pequeña pausa para no sobrecargar la API
          await this.delay(1000);
          
        } else {
          console.error(`❌ Failed to get stats for ${advertiser.pageName}:`, statsResult.error);
        }
        
      } catch (error) {
        console.error(`❌ Error processing advertiser ${advertiser.pageName}:`, error);
      }
    }

    return results;
  }

  /**
   * Obtiene las estadísticas del día anterior
   */
  private getPreviousDayStats(dailyStats: any[]): any | null {
    if (!dailyStats || dailyStats.length === 0) {
      return null;
    }

    // Ordenar por fecha y obtener el más reciente
    const sortedStats = dailyStats.sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    return sortedStats[0] || null;
  }

  /**
   * Actualiza las estadísticas del anunciante en la base de datos
   */
  private async updateAdvertiserStats(advertiserId: string, newDailyStat: any, currentActiveAds: number): Promise<void> {
    // Wait for database to be ready with retry logic
    let retries = 0;
    const maxRetries = 3;
    
    while (retries < maxRetries) {
      if (collections.trackedAdvertisers) {
        break;
      }
      
      console.log(`📊 Waiting for database for update... (attempt ${retries + 1}/${maxRetries})`);
      await this.delay(1000); // Wait 1 second
      retries++;
    }

    if (!collections.trackedAdvertisers) {
      throw new Error('Database not initialized for update after maximum retries');
    }

    await collections.trackedAdvertisers.updateOne(
      { _id: new ObjectId(advertiserId) } as any,
      {
        $push: { dailyStats: newDailyStat as any },
        $set: { 
          lastCheckedDate: new Date(),
          totalAdsTracked: newDailyStat.totalAds
        }
      } as any
    );
  }

  /**
   * Genera alertas basadas en los cambios detectados
   */
  private generateAlerts(results: any[]): AdvertiserAlert[] {
    const alerts: AdvertiserAlert[] = [];

    for (const result of results) {
      const { advertiser, change, changePercentage, currentActiveAds, previousActiveAds } = result;

      // Crecimiento significativo (+50% o más)
      if (changePercentage >= 50 && currentActiveAds >= 5) {
        alerts.push({
          type: 'growth',
          message: `${advertiser.pageName} ha aumentado sus anuncios en ${changePercentage.toFixed(1)}% (${previousActiveAds} → ${currentActiveAds})`,
          severity: 'high',
          changePercentage,
          previousAds: previousActiveAds,
          currentAds: currentActiveAds
        });
      }
      
      // Declive significativo (-30% o más)
      else if (changePercentage <= -30 && previousActiveAds >= 3) {
        alerts.push({
          type: 'decline',
          message: `${advertiser.pageName} ha disminuido sus anuncios en ${Math.abs(changePercentage).toFixed(1)}% (${previousActiveAds} → ${currentActiveAds})`,
          severity: 'high',
          changePercentage,
          previousAds: previousActiveAds,
          currentAds: currentActiveAds
        });
      }
      
      // Muy inactivo (0 anuncios)
      else if (currentActiveAds === 0 && previousActiveAds > 0) {
        alerts.push({
          type: 'inactive',
          message: `${advertiser.pageName} ya no tiene anuncios activos (anteriormente tenía ${previousActiveAds})`,
          severity: 'medium',
          changePercentage,
          previousAds: previousActiveAds,
          currentAds: currentActiveAds
        });
      }
      
      // Alta actividad (más de 50 anuncios)
      else if (currentActiveAds >= 50) {
        alerts.push({
          type: 'high_activity',
          message: `${advertiser.pageName} tiene alta actividad con ${currentActiveAds} anuncios activos`,
          severity: 'medium',
          changePercentage,
          previousAds: previousActiveAds,
          currentAds: currentActiveAds
        });
      }
    }

    return alerts;
  }

  /**
   * Envía notificaciones de alertas importantes
   */
  private async sendNotifications(alerts: AdvertiserAlert[]): Promise<void> {
    if (alerts.length === 0 || !telegramBotService.isRunning()) {
      return;
    }

    // Solo enviar alertas de alta severidad
    const highSeverityAlerts = alerts.filter(alert => alert.severity === 'high');
    
    if (highSeverityAlerts.length === 0) {
      return;
    }

    // Obtener usuarios con Telegram configurado
    const usersWithTelegram = await this.getUsersWithTelegram();
    
    if (usersWithTelegram.length === 0) {
      return;
    }

    // Crear mensaje de resumen
    const message = this.createAlertMessage(highSeverityAlerts);

    // Enviar a todos los usuarios
    for (const user of usersWithTelegram) {
      try {
        await telegramBotService.sendMessage(user.telegramId, message);
        console.log(`📱 Alert sent to user ${user.name} (${user.telegramId})`);
      } catch (error) {
        console.error(`❌ Failed to send alert to user ${user.name}:`, error);
      }
    }
  }

  /**
   * Obtiene usuarios que tienen Telegram configurado
   */
  private async getUsersWithTelegram(): Promise<any[]> {
    if (!collections.users) {
      return [];
    }

    const users = await collections.users
      .find({ 
        telegramId: { $exists: true, $nin: [null, ""] } 
      })
      .toArray();

    return users;
  }

  /**
   * Crea el mensaje de alertas
   */
  private createAlertMessage(alerts: AdvertiserAlert[]): string {
    const growthAlerts = alerts.filter(a => a.type === 'growth');
    const declineAlerts = alerts.filter(a => a.type === 'decline');
    const inactiveAlerts = alerts.filter(a => a.type === 'inactive');

    let message = `🚨 *Alertas de Monitoreo Diario*\n\n`;
    
    if (growthAlerts.length > 0) {
      message += `📈 *NICHOS EN CRECIMIENTO:*\n`;
      growthAlerts.forEach(alert => {
        message += `• ${alert.message}\n`;
      });
      message += `\n`;
    }

    if (declineAlerts.length > 0) {
      message += `📉 *NICHOS EN DECLIVE:*\n`;
      declineAlerts.forEach(alert => {
        message += `• ${alert.message}\n`;
      });
      message += `\n`;
    }

    if (inactiveAlerts.length > 0) {
      message += `❄️ *NICHOS INACTIVOS:*\n`;
      inactiveAlerts.forEach(alert => {
        message += `• ${alert.message}\n`;
      });
      message += `\n`;
    }

    message += `💡 *Recomendación:* Revisa estos nichos para decidir si entrar o salir del mercado.`;

    return message;
  }

  /**
   * Verifica si el monitoreo ya se ejecutó hoy
   */
  private hasRunToday(): boolean {
    if (!this.lastRunDate) {
      return false;
    }

    const today = new Date();
    const lastRun = new Date(this.lastRunDate);
    
    return (
      today.getFullYear() === lastRun.getFullYear() &&
      today.getMonth() === lastRun.getMonth() &&
      today.getDate() === lastRun.getDate()
    );
  }

  /**
   * Utilidad para hacer pausas
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Ejecuta análisis para un usuario específico
   */
  async runUserAnalysis(userId: string, advertisers: any[]): Promise<void> {
    if (this.isRunning) {
      console.log(`📊 Analysis already running, skipping for user ${userId}`);
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();
    
    try {
      console.log(`🚀 Starting personalized analysis for user ${userId}...`);
      
      // Verificar que la base de datos esté lista
      if (!await this.isDatabaseReady()) {
        console.log(`📊 Database not ready, skipping analysis for user ${userId}`);
        return;
      }

      console.log(`📊 Processing ${advertisers.length} advertisers for user ${userId}`);

      // Usar sistema de colas para procesamiento controlado
      console.log(`📊 Adding ${advertisers.length} advertisers to queue for user ${userId}...`);
      await cronQueueService.addAdvertisersToQueue(advertisers);
      
      // Procesar la cola (con rate limiting)
      const results = await cronQueueService.processQueue();
      
      console.log(`📊 Queue processing completed for user ${userId}: ${results.length} advertisers processed`);
      
      const executionTime = Date.now() - startTime;
      console.log(`✅ Personalized analysis completed for user ${userId} in ${executionTime}ms`);
      
    } catch (error) {
      console.error(`❌ Error in personalized analysis for user ${userId}:`, error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Obtiene el estado del monitoreo
   */
  getStatus(): { isRunning: boolean; lastRun: Date | null } {
    return {
      isRunning: this.isRunning,
      lastRun: this.lastRunDate
    };
  }
}

// Singleton instance
export const dailyAdvertiserMonitor = new DailyAdvertiserMonitor();
