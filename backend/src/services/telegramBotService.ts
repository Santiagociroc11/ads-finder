import TelegramBot from 'node-telegram-bot-api';

interface TelegramBotService {
  start(): void;
  stop(): void;
  sendMessage(chatId: string, message: string): Promise<void>;
  isRunning(): boolean;
}

class TelegramBotServiceImpl implements TelegramBotService {
  private bot: TelegramBot | null = null;
  private isPolling = false;

  constructor() {
    this.initializeBot();
  }

  private initializeBot(): void {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    
    if (!token) {
      console.warn('⚠️ TELEGRAM_BOT_TOKEN not found - Telegram bot will not start');
      return;
    }

    try {
      this.bot = new TelegramBot(token, { polling: false });
      console.log('✅ Telegram bot initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Telegram bot:', error);
    }
  }

  public start(): void {
    if (!this.bot) {
      console.warn('⚠️ Telegram bot not initialized - cannot start');
      return;
    }

    if (this.isPolling) {
      console.warn('⚠️ Telegram bot is already running');
      return;
    }

    try {
      // Start polling
      this.bot.startPolling({
        interval: 1000,
        autoStart: true,
        params: {
          timeout: 10
        }
      });

      this.isPolling = true;
      console.log('🚀 Telegram bot started polling');

      // Set up command handlers
      this.setupCommandHandlers();

    } catch (error) {
      console.error('❌ Failed to start Telegram bot polling:', error);
    }
  }

  public stop(): void {
    if (!this.bot || !this.isPolling) {
      return;
    }

    try {
      this.bot.stopPolling();
      this.isPolling = false;
      console.log('🛑 Telegram bot stopped polling');
    } catch (error) {
      console.error('❌ Error stopping Telegram bot:', error);
    }
  }

  public async sendMessage(chatId: string, message: string): Promise<void> {
    if (!this.bot) {
      throw new Error('Telegram bot not initialized');
    }

    try {
      await this.bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        disable_web_page_preview: true
      });
      console.log(`📤 Message sent to chat ${chatId}`);
    } catch (error) {
      console.error(`❌ Failed to send message to chat ${chatId}:`, error);
      throw error;
    }
  }

  public isRunning(): boolean {
    return this.isPolling && this.bot !== null;
  }

  private setupCommandHandlers(): void {
    if (!this.bot) return;

    // Handle /start command
    this.bot.onText(/\/start/, async (msg) => {
      const chatId = msg.chat.id.toString();
      const firstName = msg.from?.first_name || 'Usuario';

      const welcomeMessage = `
🤖 *¡Hola ${firstName}!*

Bienvenido al bot de notificaciones de *Ads Finder Pro*.

*Comandos disponibles:*
• /id - Obtener tu ID de Telegram
• /help - Mostrar esta ayuda

Para recibir notificaciones, ve a la aplicación y configura tu ID de Telegram en la sección de Configuración.
      `.trim();

      try {
        await this.sendMessage(chatId, welcomeMessage);
        console.log(`✅ Welcome message sent to ${chatId} (${firstName})`);
      } catch (error) {
        console.error(`❌ Failed to send welcome message to ${chatId}:`, error);
      }
    });

    // Handle /id command
    this.bot.onText(/\/id/, async (msg) => {
      const chatId = msg.chat.id.toString();
      const userId = msg.from?.id?.toString();
      const firstName = msg.from?.first_name || 'Usuario';

      if (!userId) {
        await this.sendMessage(chatId, '❌ No se pudo obtener tu ID de usuario.');
        return;
      }

      const idMessage = `
👤 *Tu información de Telegram:*

*ID de Usuario:* \`${userId}\`
*Nombre:* ${firstName}
*Chat ID:* \`${chatId}\`

📝 *Para configurar notificaciones:*
1. Copia tu ID de Usuario: \`${userId}\`
2. Ve a la aplicación Ads Finder Pro
3. Ve a Configuración
4. Pega tu ID en el campo "ID de Telegram"
5. Guarda los cambios

¡Listo! Ahora recibirás notificaciones cuando haya nuevas actualizaciones.
      `.trim();

      try {
        await this.sendMessage(chatId, idMessage);
        console.log(`✅ ID sent to ${chatId} (${firstName}): ${userId}`);
      } catch (error) {
        console.error(`❌ Failed to send ID to ${chatId}:`, error);
      }
    });

    // Handle /help command
    this.bot.onText(/\/help/, async (msg) => {
      const chatId = msg.chat.id.toString();
      const firstName = msg.from?.first_name || 'Usuario';

      const helpMessage = `
🆘 *Ayuda - Ads Finder Pro Bot*

*Comandos disponibles:*

• /start - Mensaje de bienvenida
• /id - Obtener tu ID de Telegram para configurar notificaciones
• /help - Mostrar esta ayuda

*¿Cómo configurar notificaciones?*

1. Ejecuta el comando /id
2. Copia tu ID de Usuario
3. Ve a la aplicación Ads Finder Pro
4. Navega a la sección "Configuración"
5. Pega tu ID en el campo "ID de Telegram"
6. Guarda los cambios

*¿Qué notificaciones recibirás?*
• Nuevos anuncios de anunciantes que sigues
• Actualizaciones de búsquedas guardadas
• Alertas importantes del sistema

¡Gracias por usar Ads Finder Pro! 🚀
      `.trim();

      try {
        await this.sendMessage(chatId, helpMessage);
        console.log(`✅ Help message sent to ${chatId} (${firstName})`);
      } catch (error) {
        console.error(`❌ Failed to send help message to ${chatId}:`, error);
      }
    });

    // Handle unknown commands
    this.bot.on('message', async (msg) => {
      if (msg.text && !msg.text.startsWith('/')) {
        const chatId = msg.chat.id.toString();
        const unknownMessage = `
❓ *Comando no reconocido*

Usa /help para ver los comandos disponibles.

Los comandos principales son:
• /id - Para obtener tu ID de Telegram
• /help - Para mostrar la ayuda
        `.trim();

        try {
          await this.sendMessage(chatId, unknownMessage);
        } catch (error) {
          console.error(`❌ Failed to send unknown command message to ${chatId}:`, error);
        }
      }
    });

    // Handle errors
    this.bot.on('error', (error) => {
      console.error('❌ Telegram bot error:', error);
    });

    this.bot.on('polling_error', (error) => {
      console.error('❌ Telegram bot polling error:', error);
    });

    console.log('✅ Telegram bot command handlers set up');
  }
}

// Singleton instance
const telegramBotService = new TelegramBotServiceImpl();

export { telegramBotService };
export type { TelegramBotService };
