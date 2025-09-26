import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { asyncHandler, CustomError } from '@/middleware/errorHandler.js';
import type { AIsuggestion } from '../types/shared.js';
import { aiRateLimit } from '@/middleware/rateLimiter.js';
import { cacheService } from '@/services/cacheService.js';

const router = express.Router();

// Initialize Google AI (will be initialized lazily)
let genAI: GoogleGenerativeAI | null = null;

// Function to initialize Google AI lazily
function initializeGoogleAI(): GoogleGenerativeAI | null {
  if (genAI !== null) return genAI; // Already initialized
  
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      genAI = new GoogleGenerativeAI(apiKey);
      console.log('🤖 Google Generative AI initialized');
      return genAI;
    } else {
      console.warn('⚠️ GEMINI_API_KEY not found - AI suggestions will be disabled');
      genAI = null;
      return null;
    }
  } catch (error) {
    console.error('❌ Failed to initialize Google AI:', error);
    genAI = null;
    return null;
  }
}

// POST /api/suggestions - Generate AI keyword suggestions
router.post('/', aiRateLimit, asyncHandler(async (req, res) => {
  const { idea } = req.body;
  
  if (!idea) {
    throw new CustomError('Se requiere una idea inicial', 400);
  }

  // Check cache first
  const cachedSuggestions = cacheService.getAISuggestion(idea);
  if (cachedSuggestions) {
    console.log(`[AI] ✅ Using cached suggestions for: "${idea}"`);
    return res.json({
      success: true,
      suggestions: cachedSuggestions,
      cached: true
    });
  }

  const aiService = initializeGoogleAI();
  if (!aiService) {
    console.error('[AI] ❌ Google AI service not available - GEMINI_API_KEY missing or invalid');
    throw new CustomError('El servicio de IA no está disponible. Verifica la configuración de GEMINI_API_KEY.', 503);
  }

  try {
    console.log(`[AI] 🤖 Generating suggestions for: "${idea}"`);

    const model = aiService.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
    
    const prompt = `Actúa como un experto en marketing digital y Facebook Ads. Basado en la idea general "${idea}", genera una lista de 8 palabras clave específicas y de alta intención de compra, en español, para encontrar anuncios ganadores en la biblioteca de anuncios de Facebook. Devuelve solo la lista de palabras, separadas por comas. Ejemplo: si la idea es "mascotas", devuelve "arnés para perros, comida natural para gatos, juguetes interactivos para perros, cama ortopédica para perro, fuente de agua para gatos, adiestramiento canino online, seguro para mascotas, snacks saludables para perros"`;
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Clean and format the response
    const suggestions = text.split(',').map(s => s.trim()).filter(s => s.length > 0);
    
    console.log(`[AI] ✅ Generated ${suggestions.length} suggestions`);
    
    // Cache the suggestions for 24 hours
    cacheService.setAISuggestion(idea, suggestions, 24 * 60 * 60);
    console.log(`[AI] 💾 Cached suggestions for: "${idea}"`);
    
    const aiResponse: AIsuggestion = { suggestions };
    
    return res.json(aiResponse);

  } catch (error) {
    console.error('[AI] ❌ Error generating suggestions:', error);
    throw new CustomError(
      error instanceof Error ? error.message : 'Error del servicio de IA',
      500
    );
  }
}));

// GET /api/suggestions/health - Check AI service health
router.get('/health', asyncHandler(async (req, res) => {
  const aiService = initializeGoogleAI();
  const isAvailable = !!aiService;
  
  res.json({
    available: isAvailable,
    service: 'Google Generative AI',
    model: 'gemini-2.5-flash-lite',
    status: isAvailable ? 'ready' : 'unavailable'
  });
}));

export default router;
