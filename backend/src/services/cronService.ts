import { dailyAdvertiserMonitor } from './dailyAdvertiserMonitor.js';

export class CronService {
  private dailyMonitorInterval: NodeJS.Timeout | null = null;
  private isStarted = false;

  /**
   * Inicia todos los cron jobs
   */
  start(): void {
    if (this.isStarted) {
      console.log('⏰ Cron service already started');
      return;
    }

    console.log('⏰ Starting cron service...');
    
    // Monitoreo diario de anunciantes (cada 24 horas a las 6:00 AM)
    this.startDailyAdvertiserMonitoring();
    
    this.isStarted = true;
    console.log('✅ Cron service started successfully');
  }

  /**
   * Detiene todos los cron jobs
   */
  stop(): void {
    if (!this.isStarted) {
      return;
    }

    console.log('⏹️ Stopping cron service...');

    if (this.dailyMonitorInterval) {
      clearInterval(this.dailyMonitorInterval);
      this.dailyMonitorInterval = null;
    }

    this.isStarted = false;
    console.log('✅ Cron service stopped');
  }

  /**
   * Inicia el monitoreo diario de anunciantes
   */
  private startDailyAdvertiserMonitoring(): void {
    // Ejecutar inmediatamente al iniciar (para testing)
    console.log('📊 Scheduling daily advertiser monitoring...');
    
    // Calcular el tiempo hasta la próxima ejecución (6:00 AM)
    const now = new Date();
    const nextRun = new Date();
    nextRun.setHours(6, 0, 0, 0);
    
    // Si ya pasaron las 6:00 AM de hoy, programar para mañana
    if (now >= nextRun) {
      nextRun.setDate(nextRun.getDate() + 1);
    }

    const timeUntilNextRun = nextRun.getTime() - now.getTime();
    
    console.log(`📊 Next daily monitoring scheduled for: ${nextRun.toISOString()}`);
    console.log(`📊 Time until next run: ${Math.round(timeUntilNextRun / (1000 * 60 * 60))} hours`);

    // Ejecutar después del tiempo calculado
    setTimeout(() => {
      this.runDailyMonitoring();
      // Después de la primera ejecución, ejecutar cada 24 horas
      this.dailyMonitorInterval = setInterval(() => {
        this.runDailyMonitoring();
      }, 24 * 60 * 60 * 1000); // 24 horas en milisegundos
    }, timeUntilNextRun);
  }

  /**
   * Ejecuta el monitoreo diario
   */
  private async runDailyMonitoring(): Promise<void> {
    try {
      console.log('🚀 Executing scheduled daily advertiser monitoring...');
      await dailyAdvertiserMonitor.runDailyMonitoring();
    } catch (error) {
      console.error('❌ Error in scheduled daily monitoring:', error);
    }
  }

  /**
   * Ejecuta el monitoreo manualmente (para testing)
   */
  async runDailyMonitoringNow(): Promise<void> {
    console.log('🔧 Running daily monitoring manually...');
    await dailyAdvertiserMonitor.runDailyMonitoring();
  }

  /**
   * Obtiene el estado del cron service
   */
  getStatus(): {
    isStarted: boolean;
    nextDailyMonitoring: Date | null;
    monitoringStatus: any;
  } {
    const monitoringStatus = dailyAdvertiserMonitor.getStatus();
    
    return {
      isStarted: this.isStarted,
      nextDailyMonitoring: this.dailyMonitorInterval ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null,
      monitoringStatus
    };
  }
}

// Singleton instance
export const cronService = new CronService();
