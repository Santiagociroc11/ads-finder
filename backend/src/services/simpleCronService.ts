import cron from 'node-cron';
import { dailyAdvertiserMonitor } from './dailyAdvertiserMonitor.js';

export class SimpleCronService {
  private isStarted = false;
  private cronJobs: cron.ScheduledTask[] = [];

  /**
   * Inicia el servicio de cron simple y confiable
   */
  start(): void {
    if (this.isStarted) {
      console.log('⏰ Simple cron service already started');
      return;
    }

    console.log('⏰ Starting simple cron service...');

    // Monitoreo diario principal - todos los días a las 6:00 AM
    const dailyJob = cron.schedule('0 6 * * *', async () => {
      console.log('🚀 [CRON] Iniciando monitoreo diario de anunciantes...');
      try {
        await dailyAdvertiserMonitor.runDailyMonitoring();
        console.log('✅ [CRON] Monitoreo diario completado exitosamente');
      } catch (error) {
        console.error('❌ [CRON] Error en monitoreo diario:', error);
      }
    }, {
      scheduled: false,
      timezone: 'UTC'
    });

    // Monitoreo intermedio - cada 2 horas (para anunciantes muy activos)
    const intermediateJob = cron.schedule('0 */2 * * *', async () => {
      console.log('🔄 [CRON] Monitoreo intermedio cada 2 horas...');
      try {
        // Solo procesar anunciantes que han sido muy activos recientemente
        await dailyAdvertiserMonitor.runIntermediateMonitoring();
        console.log('✅ [CRON] Monitoreo intermedio completado');
      } catch (error) {
        console.error('❌ [CRON] Error en monitoreo intermedio:', error);
      }
    }, {
      scheduled: false,
      timezone: 'UTC'
    });

    // Monitoreo de fin de semana - sábados y domingos a las 8:00 AM
    const weekendJob = cron.schedule('0 8 * * 0,6', async () => {
      console.log('📅 [CRON] Monitoreo de fin de semana...');
      try {
        await dailyAdvertiserMonitor.runWeekendMonitoring();
        console.log('✅ [CRON] Monitoreo de fin de semana completado');
      } catch (error) {
        console.error('❌ [CRON] Error en monitoreo de fin de semana:', error);
      }
    }, {
      scheduled: false,
      timezone: 'UTC'
    });

    // Almacenar referencias a los jobs
    this.cronJobs = [dailyJob, intermediateJob, weekendJob];

    // Iniciar los jobs
    this.cronJobs.forEach(job => job.start());

    this.isStarted = true;
    console.log('✅ Simple cron service started successfully');
    console.log('📅 Jobs scheduled:');
    console.log('  - Daily monitoring: 6:00 AM UTC (0 6 * * *)');
    console.log('  - Intermediate monitoring: Every 2 hours (0 */2 * * *)');
    console.log('  - Weekend monitoring: 8:00 AM UTC on Sat/Sun (0 8 * * 0,6)');
  }

  /**
   * Detiene el servicio de cron
   */
  stop(): void {
    if (!this.isStarted) {
      return;
    }

    console.log('⏰ Stopping simple cron service...');
    
    this.cronJobs.forEach(job => {
      job.stop();
      job.destroy();
    });
    
    this.cronJobs = [];
    this.isStarted = false;
    
    console.log('✅ Simple cron service stopped');
  }

  /**
   * Obtiene el estado del servicio
   */
  getStatus() {
    return {
      isStarted: this.isStarted,
      activeJobs: this.cronJobs.length,
      jobs: [
        {
          name: 'Daily Monitoring',
          schedule: '0 6 * * *',
          description: 'Monitoreo diario principal de anunciantes'
        },
        {
          name: 'Intermediate Monitoring',
          schedule: '0 */2 * * *',
          description: 'Monitoreo cada 2 horas para anunciantes activos'
        },
        {
          name: 'Weekend Monitoring',
          schedule: '0 8 * * 0,6',
          description: 'Monitoreo especial de fin de semana'
        }
      ]
    };
  }

  /**
   * Ejecuta el monitoreo diario manualmente (para testing/admin)
   */
  async runDailyMonitoringNow(): Promise<void> {
    console.log('🔧 [MANUAL] Ejecutando monitoreo diario manualmente...');
    try {
      await dailyAdvertiserMonitor.runDailyMonitoring();
      console.log('✅ [MANUAL] Monitoreo diario manual completado');
    } catch (error) {
      console.error('❌ [MANUAL] Error en monitoreo diario manual:', error);
      throw error;
    }
  }

  /**
   * Ejecuta el monitoreo intermedio manualmente
   */
  async runIntermediateMonitoringNow(): Promise<void> {
    console.log('🔧 [MANUAL] Ejecutando monitoreo intermedio manualmente...');
    try {
      await dailyAdvertiserMonitor.runIntermediateMonitoring();
      console.log('✅ [MANUAL] Monitoreo intermedio manual completado');
    } catch (error) {
      console.error('❌ [MANUAL] Error en monitoreo intermedio manual:', error);
      throw error;
    }
  }
}

// Singleton instance
export const simpleCronService = new SimpleCronService();
