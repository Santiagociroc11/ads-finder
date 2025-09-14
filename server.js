require('dotenv').config();

// --- Dependencias ---
const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const fetch = require('node-fetch');
const cors = require('cors');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
// Nueva dependencia para la IA de Google
const { GoogleGenerativeAI } = require('@google/generative-ai');
// Cliente de Apify para scraping profesional
const { ApifyClient } = require('apify-client');

// Función para calcular el "calor" del producto
function calculateHotnessScore(collationCount, daysRunning) {
    // Score base por collation_count (cuantas variaciones tiene)
    let baseScore = Math.min(collationCount * 10, 100); // Máximo 100 puntos por variaciones
    
    // Bonus por días corriendo (productos que duran son exitosos)
    let durationBonus = 0;
    if (daysRunning > 30) durationBonus = 30;      // +30 si lleva más de 30 días
    else if (daysRunning > 15) durationBonus = 20; // +20 si lleva más de 15 días
    else if (daysRunning > 7) durationBonus = 10;  // +10 si lleva más de 7 días
    
    const totalScore = baseScore + durationBonus;
    
    // Normalizar a escala 1-5 para las llamas
    return Math.min(Math.max(Math.round(totalScore / 25), 1), 5);
}

// Función para obtener emoji de llamas según el score
function getFlameEmoji(hotnessScore) {
    switch(hotnessScore) {
        case 5: return '🔥🔥🔥🔥🔥'; // Super caliente
        case 4: return '🔥🔥🔥🔥';   // Muy caliente  
        case 3: return '🔥🔥🔥';     // Caliente
        case 2: return '🔥🔥';       // Templado
        case 1: return '🔥';         // Poco caliente
        default: return '';          // Sin llamas
    }
}

// --- Configuración ---
const app = express();
const port = 3000;
const mongoUrl = process.env.MONGO_URL || 'mongodb://localhost:27017';
const dbName = 'adFinder';
// Inicializar el cliente de IA con la clave del .env
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// --- Middlewares ---
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// --- Conexión a la Base de Datos ---
let db;
MongoClient.connect(mongoUrl)
    .then(client => {
        console.log('Conectado a la base de datos MongoDB');
        db = client.db(dbName);
    })
    .catch(error => console.error('Error al conectar a MongoDB:', error));

// --- Rutas de la API ---

// RUTAS PARA ANUNCIOS GUARDADOS (RESULTADOS)
app.post('/api/saved-ads', async (req, res) => {
    if (!db) return res.status(500).json({ message: 'Conexión a la base de datos no establecida.' });
    
    const { adData, tags, notes, collection } = req.body;
    if (!adData || !adData.id) {
        return res.status(400).json({ message: 'Datos del anuncio son requeridos.' });
    }

    try {
        // Verificar que no exista el anuncio ya guardado
        const existingAd = await db.collection('savedAds').findOne({ 'adData.id': adData.id });
        if (existingAd) {
            return res.status(409).json({ message: 'Este anuncio ya está guardado.' });
        }

        const newSavedAd = {
            adData: adData, // Todo el objeto del anuncio
            tags: tags || [], // Etiquetas para categorizar
            notes: notes || '', // Notas personales
            collection: collection || 'General', // Colección/carpeta
            savedAt: new Date(),
            lastViewed: new Date(),
            isFavorite: false,
            analysis: {
                hotnessScore: adData.hotness_score || 0,
                daysRunning: adData.days_running || 0,
                isLongRunning: adData.is_long_running || false
            }
        };

        const result = await db.collection('savedAds').insertOne(newSavedAd);
        
        console.log(`[SAVED_ADS] ✅ Nuevo anuncio guardado: ${adData.page_name} (ID: ${adData.id})`);
        res.status(201).json({ 
            ...newSavedAd, 
            _id: result.insertedId,
            message: 'Anuncio guardado exitosamente' 
        });

    } catch (error) {
        console.error("Error al guardar anuncio:", error);
        res.status(500).json({ message: 'Error al guardar el anuncio.' });
    }
});

app.get('/api/saved-ads', async (req, res) => {
    if (!db) return res.status(500).json({ message: 'Base de datos no conectada.' });
    
    try {
        const { collection, tags, isFavorite, sortBy, limit } = req.query;
        
        // Construir filtro
        let filter = {};
        if (collection && collection !== 'all') {
            filter.collection = collection;
        }
        if (tags) {
            const tagArray = tags.split(',');
            filter.tags = { $in: tagArray };
        }
        if (isFavorite === 'true') {
            filter.isFavorite = true;
        }
        
        // Configurar ordenamiento
        let sort = {};
        switch (sortBy) {
            case 'savedAt':
                sort = { savedAt: -1 };
                break;
            case 'hotness':
                sort = { 'analysis.hotnessScore': -1 };
                break;
            case 'daysRunning':
                sort = { 'analysis.daysRunning': -1 };
                break;
            case 'pageName':
                sort = { 'adData.page_name': 1 };
                break;
            default:
                sort = { savedAt: -1 };
        }
        
        let query = db.collection('savedAds').find(filter).sort(sort);
        if (limit) {
            query = query.limit(parseInt(limit));
        }
        
        const savedAds = await query.toArray();
        
        // Agregar estadísticas
        const stats = await db.collection('savedAds').aggregate([
            { $group: { 
                _id: null, 
                total: { $sum: 1 },
                favorites: { $sum: { $cond: ['$isFavorite', 1, 0] } },
                collections: { $addToSet: '$collection' },
                avgHotness: { $avg: '$analysis.hotnessScore' }
            }}
        ]).toArray();
        
        res.json({
            ads: savedAds,
            stats: stats[0] || { total: 0, favorites: 0, collections: [], avgHotness: 0 }
        });
    } catch (error) {
        console.error("Error al obtener anuncios guardados:", error);
        res.status(500).json({ message: 'Error al obtener anuncios guardados.' });
    }
});

app.put('/api/saved-ads/:id', async (req, res) => {
    if (!db) return res.status(500).json({ message: 'Base de datos no conectada.' });
    
    try {
        const { id } = req.params;
        const { tags, notes, collection, isFavorite } = req.body;
        
        const updateFields = {};
        if (tags !== undefined) updateFields.tags = tags;
        if (notes !== undefined) updateFields.notes = notes;
        if (collection !== undefined) updateFields.collection = collection;
        if (isFavorite !== undefined) updateFields.isFavorite = isFavorite;
        updateFields.lastViewed = new Date();
        
        const result = await db.collection('savedAds').updateOne(
            { _id: new ObjectId(id) },
            { $set: updateFields }
        );
        
        if (result.matchedCount === 0) {
            return res.status(404).json({ message: 'Anuncio guardado no encontrado.' });
        }
        
        console.log(`[SAVED_ADS] ✏️ Anuncio actualizado: ${id}`);
        res.status(200).json({ message: 'Anuncio actualizado exitosamente.' });
    } catch (error) {
        console.error("Error al actualizar anuncio guardado:", error);
        res.status(500).json({ message: 'Error al actualizar el anuncio guardado.' });
    }
});

app.delete('/api/saved-ads/:id', async (req, res) => {
    if (!db) return res.status(500).json({ message: 'Base de datos no conectada.' });
    
    try {
        const { id } = req.params;
        const result = await db.collection('savedAds').deleteOne({ _id: new ObjectId(id) });
        
        if (result.deletedCount === 0) {
            return res.status(404).json({ message: 'Anuncio guardado no encontrado.' });
        }
        
        console.log(`[SAVED_ADS] 🗑️ Anuncio eliminado: ${id}`);
        res.status(200).json({ message: 'Anuncio guardado eliminado con éxito.' });
    } catch (error) {
        console.error("Error al eliminar anuncio guardado:", error);
        res.status(500).json({ message: 'Error al eliminar el anuncio guardado.' });
    }
});

// Endpoint para obtener colecciones disponibles
app.get('/api/saved-ads/collections', async (req, res) => {
    if (!db) return res.status(500).json({ message: 'Base de datos no conectada.' });
    
    try {
        const collections = await db.collection('savedAds').aggregate([
            { $group: { 
                _id: '$collection', 
                count: { $sum: 1 },
                lastAdded: { $max: '$savedAt' }
            }},
            { $sort: { count: -1 }}
        ]).toArray();
        
        res.json(collections);
    } catch (error) {
        console.error("Error al obtener colecciones:", error);
        res.status(500).json({ message: 'Error al obtener colecciones.' });
    }
});

// Endpoint para obtener tags disponibles
app.get('/api/saved-ads/tags', async (req, res) => {
    if (!db) return res.status(500).json({ message: 'Base de datos no conectada.' });
    
    try {
        const tags = await db.collection('savedAds').aggregate([
            { $unwind: '$tags' },
            { $group: { _id: '$tags', count: { $sum: 1 }}},
            { $sort: { count: -1 }}
        ]).toArray();
        
        res.json(tags);
    } catch (error) {
        console.error("Error al obtener tags:", error);
        res.status(500).json({ message: 'Error al obtener tags.' });
    }
});

// Endpoint para guardar múltiples anuncios (desde una búsqueda)
app.post('/api/saved-ads/bulk', async (req, res) => {
    if (!db) return res.status(500).json({ message: 'Base de datos no conectada.' });
    
    const { ads, defaultTags, defaultCollection, defaultNotes } = req.body;
    if (!ads || !Array.isArray(ads) || ads.length === 0) {
        return res.status(400).json({ message: 'Se requiere un array de anuncios.' });
    }

    try {
        const results = {
            saved: 0,
            skipped: 0,
            errors: 0,
            details: []
        };

        // Verificar cuáles anuncios ya existen
        const existingAdIds = await db.collection('savedAds').find(
            { 'adData.id': { $in: ads.map(ad => ad.id) } }
        ).toArray();
        const existingIds = new Set(existingAdIds.map(ad => ad.adData.id));

        const adsToSave = [];
        
        for (const adData of ads) {
            if (existingIds.has(adData.id)) {
                results.skipped++;
                results.details.push({
                    adId: adData.id,
                    status: 'skipped',
                    reason: 'Ya existe'
                });
                continue;
            }

            const newSavedAd = {
                adData: adData,
                tags: defaultTags || [],
                notes: defaultNotes || '',
                collection: defaultCollection || 'General',
                savedAt: new Date(),
                lastViewed: new Date(),
                isFavorite: false,
                analysis: {
                    hotnessScore: adData.hotness_score || 0,
                    daysRunning: adData.days_running || 0,
                    isLongRunning: adData.is_long_running || false
                }
            };

            adsToSave.push(newSavedAd);
            results.details.push({
                adId: adData.id,
                status: 'pending',
                pageName: adData.page_name
            });
        }

        // Guardar anuncios en lote
        if (adsToSave.length > 0) {
            const insertResult = await db.collection('savedAds').insertMany(adsToSave);
            results.saved = insertResult.insertedCount;
            
            // Actualizar detalles con éxito
            results.details.forEach(detail => {
                if (detail.status === 'pending') {
                    detail.status = 'saved';
                }
            });
        }

        console.log(`[SAVED_ADS] 📦 Guardado masivo: ${results.saved} guardados, ${results.skipped} omitidos`);
        res.json({
            message: `Guardado masivo completado: ${results.saved} anuncios guardados, ${results.skipped} ya existían`,
            results: results
        });

    } catch (error) {
        console.error("Error en guardado masivo:", error);
        res.status(500).json({ message: 'Error en el guardado masivo de anuncios.' });
    }
});

// RUTAS PARA BÚSQUEDAS COMPLETAS GUARDADAS (para no re-ejecutar Apify costoso)
app.post('/api/complete-searches', async (req, res) => {
    if (!db) return res.status(500).json({ message: 'Conexión a la base de datos no establecida.' });
    
    const { searchName, searchParams, results, source, metadata } = req.body;
    if (!searchName || !results || !Array.isArray(results)) {
        return res.status(400).json({ message: 'Nombre de búsqueda y resultados son requeridos.' });
    }

    try {
        // Verificar que no exista una búsqueda con el mismo nombre
        const existingSearch = await db.collection('completeSearches').findOne({ searchName: searchName });
        if (existingSearch) {
            return res.status(409).json({ message: 'Ya existe una búsqueda guardada con ese nombre.' });
        }

        const newCompleteSearch = {
            searchName: searchName,
            searchParams: searchParams || {},
            executedAt: new Date(),
            source: source || 'unknown',
            totalResults: results.length,
            results: results, // Todos los anuncios
            metadata: {
                country: searchParams?.country || 'N/A',
                searchTerm: searchParams?.value || 'N/A',
                minDays: searchParams?.minDays || 0,
                adType: searchParams?.adType || 'ALL',
                useApify: searchParams?.useApify || false,
                ...metadata
            },
            stats: {
                avgHotnessScore: results.length > 0 ? results.reduce((sum, ad) => sum + (ad.hotness_score || 0), 0) / results.length : 0,
                longRunningAds: results.filter(ad => ad.is_long_running).length,
                topPages: [...new Set(results.map(ad => ad.page_name))].slice(0, 10)
            },
            lastAccessed: new Date(),
            accessCount: 0
        };

        const result = await db.collection('completeSearches').insertOne(newCompleteSearch);
        
        console.log(`[COMPLETE_SEARCH] ✅ Búsqueda completa guardada: "${searchName}" con ${results.length} anuncios`);
        res.status(201).json({ 
            ...newCompleteSearch, 
            _id: result.insertedId,
            message: `Búsqueda completa guardada: ${results.length} anuncios` 
        });

    } catch (error) {
        console.error("Error al guardar búsqueda completa:", error);
        res.status(500).json({ message: 'Error al guardar la búsqueda completa.' });
    }
});

app.get('/api/complete-searches', async (req, res) => {
    if (!db) return res.status(500).json({ message: 'Base de datos no conectada.' });
    
    try {
        const { sortBy, limit } = req.query;
        
        // Configurar ordenamiento
        let sort = {};
        switch (sortBy) {
            case 'executedAt':
                sort = { executedAt: -1 };
                break;
            case 'totalResults':
                sort = { totalResults: -1 };
                break;
            case 'lastAccessed':
                sort = { lastAccessed: -1 };
                break;
            case 'searchName':
                sort = { searchName: 1 };
                break;
            default:
                sort = { executedAt: -1 };
        }
        
        // Proyección para no cargar todos los resultados (solo metadata)
        const projection = {
            searchName: 1,
            searchParams: 1,
            executedAt: 1,
            source: 1,
            totalResults: 1,
            metadata: 1,
            stats: 1,
            lastAccessed: 1,
            accessCount: 1
            // results: 0  // No incluir resultados completos
        };
        
        let query = db.collection('completeSearches').find({}, { projection }).sort(sort);
        if (limit) {
            query = query.limit(parseInt(limit));
        }
        
        const completeSearches = await query.toArray();
        
        // Agregar información útil
        const enrichedSearches = completeSearches.map(search => ({
            ...search,
            searchSummary: `${search.metadata.searchTerm} | ${search.metadata.country} | ${search.totalResults} anuncios | ${search.source}`,
            isRecent: search.executedAt && (new Date() - new Date(search.executedAt)) < (7 * 24 * 60 * 60 * 1000), // Últimos 7 días
            costSavings: search.source === 'apify_scraping' ? `💰 Evita re-ejecutar Apify` : ''
        }));
        
        // Estadísticas generales
        const globalStats = await db.collection('completeSearches').aggregate([
            { $group: { 
                _id: null, 
                totalSearches: { $sum: 1 },
                totalAds: { $sum: '$totalResults' },
                apifySearches: { $sum: { $cond: [{ $eq: ['$source', 'apify_scraping'] }, 1, 0] } },
                avgAdsPerSearch: { $avg: '$totalResults' }
            }}
        ]).toArray();
        
        res.json({
            searches: enrichedSearches,
            stats: globalStats[0] || { totalSearches: 0, totalAds: 0, apifySearches: 0, avgAdsPerSearch: 0 }
        });
    } catch (error) {
        console.error("Error al obtener búsquedas completas:", error);
        res.status(500).json({ message: 'Error al obtener búsquedas completas.' });
    }
});

app.get('/api/complete-searches/:id', async (req, res) => {
    if (!db) return res.status(500).json({ message: 'Base de datos no conectada.' });
    
    try {
        const { id } = req.params;
        const { page = 1, limit = 50 } = req.query;
        
        const completeSearch = await db.collection('completeSearches').findOne({ _id: new ObjectId(id) });
        
        if (!completeSearch) {
            return res.status(404).json({ message: 'Búsqueda completa no encontrada.' });
        }
        
        // Actualizar estadísticas de acceso
        await db.collection('completeSearches').updateOne(
            { _id: new ObjectId(id) },
            { 
                $set: { lastAccessed: new Date() },
                $inc: { accessCount: 1 }
            }
        );
        
        // Paginación de resultados
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const startIndex = (pageNum - 1) * limitNum;
        const endIndex = startIndex + limitNum;
        
        const paginatedResults = completeSearch.results.slice(startIndex, endIndex);
        
        console.log(`[COMPLETE_SEARCH] 📖 Cargando búsqueda "${completeSearch.searchName}": página ${pageNum}, ${paginatedResults.length} anuncios`);
        
        res.json({
            ...completeSearch,
            results: paginatedResults,
            pagination: {
                currentPage: pageNum,
                totalPages: Math.ceil(completeSearch.totalResults / limitNum),
                totalResults: completeSearch.totalResults,
                resultsPerPage: limitNum,
                hasNextPage: endIndex < completeSearch.totalResults,
                hasPrevPage: pageNum > 1
            },
            message: `Búsqueda cargada desde cache - Sin costo adicional`
        });
        
    } catch (error) {
        console.error("Error al cargar búsqueda completa:", error);
        res.status(500).json({ message: 'Error al cargar la búsqueda completa.' });
    }
});

app.delete('/api/complete-searches/:id', async (req, res) => {
    if (!db) return res.status(500).json({ message: 'Base de datos no conectada.' });
    
    try {
        const { id } = req.params;
        const completeSearch = await db.collection('completeSearches').findOne({ _id: new ObjectId(id) });
        
        if (!completeSearch) {
            return res.status(404).json({ message: 'Búsqueda completa no encontrada.' });
        }
        
        const result = await db.collection('completeSearches').deleteOne({ _id: new ObjectId(id) });
        
        console.log(`[COMPLETE_SEARCH] 🗑️ Búsqueda completa eliminada: "${completeSearch.searchName}" (${completeSearch.totalResults} anuncios)`);
        res.status(200).json({ 
            message: `Búsqueda "${completeSearch.searchName}" eliminada exitosamente.`,
            deletedResults: completeSearch.totalResults
        });
    } catch (error) {
        console.error("Error al eliminar búsqueda completa:", error);
        res.status(500).json({ message: 'Error al eliminar la búsqueda completa.' });
    }
});

// Endpoint para buscar en búsquedas guardadas
app.get('/api/complete-searches/search', async (req, res) => {
    if (!db) return res.status(500).json({ message: 'Base de datos no conectada.' });
    
    try {
        const { q, source, country, minResults } = req.query;
        
        let filter = {};
        
        // Filtro de texto
        if (q) {
            filter.$or = [
                { searchName: { $regex: q, $options: 'i' } },
                { 'metadata.searchTerm': { $regex: q, $options: 'i' } }
            ];
        }
        
        // Filtro por fuente
        if (source) {
            filter.source = source;
        }
        
        // Filtro por país
        if (country) {
            filter['metadata.country'] = country;
        }
        
        // Filtro por mínimo de resultados
        if (minResults) {
            filter.totalResults = { $gte: parseInt(minResults) };
        }
        
        const searches = await db.collection('completeSearches')
            .find(filter, { 
                projection: { 
                    results: 0 // No incluir resultados completos en búsqueda
                }
            })
            .sort({ executedAt: -1 })
            .limit(50)
            .toArray();
        
        res.json({
            searches: searches,
            total: searches.length,
            query: { q, source, country, minResults }
        });
        
    } catch (error) {
        console.error("Error buscando en búsquedas guardadas:", error);
        res.status(500).json({ message: 'Error en la búsqueda.' });
    }
});

// Endpoint para obtener estadísticas detalladas
app.get('/api/complete-searches/stats', async (req, res) => {
    if (!db) return res.status(500).json({ message: 'Base de datos no conectada.' });
    
    try {
        const stats = await db.collection('completeSearches').aggregate([
            {
                $group: {
                    _id: null,
                    totalSearches: { $sum: 1 },
                    totalAds: { $sum: '$totalResults' },
                    avgAdsPerSearch: { $avg: '$totalResults' },
                    apifySearches: { $sum: { $cond: [{ $eq: ['$source', 'apify_scraping'] }, 1, 0] } },
                    apiSearches: { $sum: { $cond: [{ $eq: ['$source', 'facebook_api'] }, 1, 0] } },
                    totalAccesses: { $sum: '$accessCount' },
                    avgHotness: { $avg: '$stats.avgHotnessScore' }
                }
            }
        ]).toArray();
        
        // Top países
        const topCountries = await db.collection('completeSearches').aggregate([
            { $group: { _id: '$metadata.country', count: { $sum: 1 }, totalAds: { $sum: '$totalResults' } }},
            { $sort: { count: -1 }},
            { $limit: 10 }
        ]).toArray();
        
        // Top términos de búsqueda
        const topTerms = await db.collection('completeSearches').aggregate([
            { $group: { _id: '$metadata.searchTerm', count: { $sum: 1 }, totalAds: { $sum: '$totalResults' } }},
            { $sort: { count: -1 }},
            { $limit: 10 }
        ]).toArray();
        
        // Búsquedas más accedidas
        const mostAccessed = await db.collection('completeSearches').aggregate([
            { $match: { accessCount: { $gt: 0 } }},
            { $sort: { accessCount: -1 }},
            { $limit: 5 },
            { $project: { searchName: 1, accessCount: 1, totalResults: 1, source: 1 }}
        ]).toArray();
        
        // Potencial ahorro (estimado)
        const apifySearchCount = (stats[0]?.apifySearches || 0);
        const avgApifyResults = await db.collection('completeSearches').aggregate([
            { $match: { source: 'apify_scraping' }},
            { $group: { _id: null, avgResults: { $avg: '$totalResults' }}}
        ]).toArray();
        
        const estimatedCostSavings = apifySearchCount * 0.05; // Estimado $0.05 por búsqueda
        
        res.json({
            overview: stats[0] || {},
            costSavings: {
                apifySearchesSaved: apifySearchCount,
                estimatedSavings: `$${estimatedCostSavings.toFixed(2)}`,
                avgResultsPerApify: avgApifyResults[0]?.avgResults || 0
            },
            topCountries: topCountries,
            topTerms: topTerms,
            mostAccessed: mostAccessed,
            message: `${apifySearchCount} búsquedas Apify guardadas - Evitas re-ejecutar costosas`
        });
        
    } catch (error) {
        console.error("Error obteniendo estadísticas:", error);
        res.status(500).json({ message: 'Error obteniendo estadísticas.' });
    }
});

// NUEVA RUTA PARA SUGERENCIAS DE IA
app.post('/api/suggestions', async (req, res) => {
    const { idea } = req.body;
    if (!idea) {
        return res.status(400).json({ message: 'Se requiere una idea inicial.' });
    }

    try {
        // --- INICIO DE LA CORRECCIÓN ---
        // Se actualizó el nombre del modelo al más reciente.
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
        // --- FIN DE LA CORRECCIÓN ---
        
        const prompt = `Actúa como un experto en marketing digital y Facebook Ads. Basado en la idea general "${idea}", genera una lista de 8 palabras clave específicas y de alta intención de compra, en español, para encontrar anuncios ganadores en la biblioteca de anuncios de Facebook. Devuelve solo la lista de palabras, separadas por comas. Ejemplo: si la idea es "mascotas", devuelve "arnés para perros, comida natural para gatos, juguetes interactivos para perros, cama ortopédica para perro, fuente de agua para gatos, adiestramiento canino online, seguro para mascotas, snacks saludables para perros"`;
        
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Limpiar y formatear la respuesta
        const suggestions = text.split(',').map(s => s.trim());
        res.json({ suggestions });

    } catch (error) {
        console.error("Error al generar sugerencias con la IA:", error);
        res.status(500).json({ message: 'Error al comunicarse con el motor de IA.' });
    }
});


app.post('/api/pages', async (req, res) => {
    if (!db) return res.status(500).json({ message: 'Conexión a la base de datos no establecida.' });
    const { pageIdentifier } = req.body;
    if (!pageIdentifier) {
        return res.status(400).json({ message: 'Se requiere un identificador de página.' });
    }

    try {
        let identifier = pageIdentifier;
        if (pageIdentifier.includes('facebook.com')) {
            console.log(`[INFO] Se detectó una URL. Intentando extraer identificador: ${pageIdentifier}`);
            const url = new URL(pageIdentifier);
            if (url.pathname.includes('profile.php')) {
                identifier = url.searchParams.get('id');
            } else {
                identifier = url.pathname.split('/').filter(Boolean).pop();
            }
            console.log(`[INFO] Identificador extraído: ${identifier}. Consultando a Facebook...`);
        }
        
        const fbResponse = await fetch(`https://graph.facebook.com/v21.0/${identifier}?fields=name&access_token=${process.env.FACEBOOK_ACCESS_TOKEN}`);
        const fbData = await fbResponse.json();

        if (fbData.error) {
             throw new Error(fbData.error.message);
        }

        const newPage = { pageId: fbData.id, pageName: fbData.name, createdAt: new Date() };
        await db.collection('trackedPages').insertOne(newPage);
        res.status(201).json(newPage);

    } catch (error) {
        console.error("Error en /api/pages (POST):", error);
        res.status(500).json({ message: `Error de Facebook al obtener ID: ${error.message}` });
    }
});

app.get('/api/pages', async (req, res) => {
    if (!db) return res.status(500).json({ message: 'Base de datos no conectada.' });
    try {
        const pages = await db.collection('trackedPages').find().toArray();
        res.json(pages);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener páginas.' });
    }
});

app.delete('/api/pages/:id', async (req, res) => {
    if (!db) return res.status(500).json({ message: 'Base de datos no conectada.' });
    try {
        const { id } = req.params;
        const result = await db.collection('trackedPages').deleteOne({ _id: new ObjectId(id) });
        if (result.deletedCount === 0) {
            return res.status(404).json({ message: 'Página no encontrada.' });
        }
        res.status(200).json({ message: 'Página eliminada con éxito.' });
    } catch (error) {
        res.status(500).json({ message: 'Error al eliminar la página.' });
    }
});


async function fetchMultiplePages(initialEndpoint, maxPages = 5) {
    const allResults = [];
    let currentUrl = initialEndpoint;
    let pageCount = 0;
    let totalCount = 0;

    while (currentUrl && pageCount < maxPages) {
        try {
            console.log(`[INFO] Obteniendo página ${pageCount + 1}/${maxPages}...`);
            const response = await fetch(currentUrl);
            const data = await response.json();

            if (data.error) {
                console.error(`[ERROR] Error en página ${pageCount + 1}:`, data.error);
                break;
            }

            if (data.data && data.data.length > 0) {
                allResults.push(...data.data);
                totalCount += data.data.length;
                console.log(`[INFO] Página ${pageCount + 1}: ${data.data.length} anuncios obtenidos. Total acumulado: ${totalCount}`);
            }

            // Preparar para la siguiente página
            currentUrl = data.paging?.next || null;
            pageCount++;

            // Pequeña pausa entre requests para evitar rate limiting
            if (currentUrl && pageCount < maxPages) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }

        } catch (error) {
            console.error(`[ERROR] Error obteniendo página ${pageCount + 1}:`, error.message);
            break;
        }
    }

    console.log(`[INFO] Paginado completado: ${pageCount} páginas, ${totalCount} anuncios totales`);
    return {
        data: allResults,
        totalPages: pageCount,
        totalAds: totalCount,
        paging: currentUrl ? { next: currentUrl } : null
    };
}

// Variable global para mantener la instancia del browser
let globalBrowser = null;

// Función para obtener o crear browser compartido
async function getSharedBrowser() {
    if (!globalBrowser || !globalBrowser.isConnected()) {
        const puppeteerOptions = {
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor',
                '--disable-blink-features=AutomationControlled',
                '--disable-extensions'
            ]
        };

        // Intentar diferentes rutas de Chrome
        const chromePaths = [
            '/usr/bin/google-chrome-stable',
            '/usr/bin/google-chrome',
            '/usr/bin/chromium-browser',
            '/usr/bin/chromium',
            '/snap/bin/chromium'
        ];

        for (const chromePath of chromePaths) {
            try {
                if (fs.existsSync(chromePath)) {
                    puppeteerOptions.executablePath = chromePath;
                    break;
                }
            } catch (e) {
                // Continuar con el siguiente path
            }
        }

        globalBrowser = await puppeteer.launch(puppeteerOptions);
        console.log(`[SCREENSHOT] Browser compartido iniciado`);
    }
    return globalBrowser;
}

// Función para inspeccionar la estructura de Facebook Ads Library
async function inspectAdsLibraryStructure(searchTerms, country = 'CO') {
    let browser, page;
    
    try {
        browser = await getSharedBrowser();
        page = await browser.newPage();
        
        console.log(`[INSPECT] 🔍 Inspeccionando estructura de Facebook Ads Library...`);
        
        // Configuración de página más stealth
        await Promise.all([
            page.setViewport({ width: 1920, height: 1080 }),
            page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'),
            page.setExtraHTTPHeaders({
                'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Encoding': 'gzip, deflate, br',
                'DNT': '1',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none'
            })
        ]);
        
        // Ocultar que es Puppeteer
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined,
            });
            
            // Eliminar rastros de automatización
            delete navigator.__proto__.webdriver;
            
            // Simular comportamiento de usuario real
            Object.defineProperty(navigator, 'plugins', {
                get: () => [1, 2, 3, 4, 5],
            });
            
            Object.defineProperty(navigator, 'languages', {
                get: () => ['es-ES', 'es', 'en'],
            });
        });
        
        // Construir URL
        const baseUrl = 'https://www.facebook.com/ads/library/';
        const params = new URLSearchParams({
            active_status: 'active',
            ad_type: 'all',
            country: country,
            media_type: 'all',
            q: searchTerms,
            search_type: 'keyword_unordered'
        });
        
        const searchUrl = `${baseUrl}?${params.toString()}`;
        console.log(`[INSPECT] 📍 Navegando a: ${searchUrl}`);
        
        // Navegar como un usuario real
        console.log(`[INSPECT] 🌐 Navegando a Facebook primero...`);
        await page.goto('https://www.facebook.com', { 
            waitUntil: 'domcontentloaded',
            timeout: 30000 
        });
        
        // Simular pausa de usuario real
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log(`[INSPECT] 🔍 Navegando a Ads Library...`);
        await page.goto(searchUrl, { 
            waitUntil: 'domcontentloaded',
            timeout: 30000 
        });
        
        // Esperar carga y simular comportamiento humano
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Simular movimiento de mouse
        await page.mouse.move(100, 100);
        await page.mouse.move(200, 200);
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Tomar screenshot para debugging
        const screenshotPath = path.join(__dirname, 'screenshots', 'facebook_ads_library_debug.png');
        await page.screenshot({
            path: screenshotPath,
            type: 'png',
            fullPage: true
        });
        console.log(`[INSPECT] 📸 Screenshot guardado en: ${screenshotPath}`);
        
        // Verificar si hay algún modal o overlay que bloquee
        await page.evaluate(() => {
            // Intentar cerrar cualquier modal
            const closeButtons = document.querySelectorAll('[aria-label*="close"], [aria-label*="cerrar"], .close, [data-testid*="close"]');
            closeButtons.forEach(btn => {
                try {
                    btn.click();
                } catch (e) {}
            });
            
            // Hacer scroll para activar carga lazy
            window.scrollTo(0, 500);
        });
        
        // Esperar más tiempo después del scroll
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Inspeccionar estructura
        const pageInfo = await page.evaluate(() => {
            const info = {
                title: document.title,
                url: window.location.href,
                bodyText: document.body.textContent.slice(0, 500),
                hasResults: false,
                possibleAdContainers: [],
                dataTestIds: [],
                commonClasses: [],
                allText: [],
                linksFound: []
            };
            
            // Verificar si hay texto que indique resultados
            info.hasResults = document.body.textContent.includes('resultado') || 
                             document.body.textContent.includes('anuncio') ||
                             document.body.textContent.includes('publicidad');
            
            // Obtener todos los enlaces que podrían ser de anuncios
            const links = document.querySelectorAll('a[href*="facebook.com/ads/archive"]');
            links.forEach(link => {
                info.linksFound.push({
                    href: link.href,
                    text: link.textContent.slice(0, 100),
                    parentClasses: link.parentElement ? link.parentElement.className : '',
                    parentTestId: link.parentElement ? link.parentElement.getAttribute('data-testid') : ''
                });
            });
            
            // Obtener todos los elementos con data-testid
            const elementsWithTestId = document.querySelectorAll('[data-testid]');
            elementsWithTestId.forEach(el => {
                info.dataTestIds.push({
                    testId: el.getAttribute('data-testid'),
                    tag: el.tagName,
                    classes: el.className,
                    text: el.textContent.slice(0, 100) + (el.textContent.length > 100 ? '...' : '')
                });
            });
            
            // Buscar elementos que podrían ser contenedores de anuncios
            const possibleSelectors = [
                '[data-testid*="ad"]',
                '[data-testid*="search"]',
                '[data-testid*="result"]',
                '[data-testid*="creative"]',
                '[data-testid*="card"]',
                '.ad-card',
                '.search-result',
                '[class*="ad"]',
                '[class*="Ad"]',
                '[class*="result"]',
                '[class*="card"]'
            ];
            
            possibleSelectors.forEach(selector => {
                try {
                    const elements = document.querySelectorAll(selector);
                    if (elements.length > 0) {
                        info.possibleAdContainers.push({
                            selector: selector,
                            count: elements.length,
                            firstElementClasses: elements[0].className,
                            firstElementText: elements[0].textContent.slice(0, 150) + '...'
                        });
                    }
                } catch (e) {
                    // Ignorar selectores inválidos
                }
            });
            
            // Obtener clases más comunes
            const allElements = document.querySelectorAll('*');
            const classCount = {};
            allElements.forEach(el => {
                if (el.className && typeof el.className === 'string') {
                    el.className.split(' ').forEach(cls => {
                        if (cls.trim()) {
                            classCount[cls] = (classCount[cls] || 0) + 1;
                        }
                    });
                }
            });
            
            // Top 20 clases más comunes
            info.commonClasses = Object.entries(classCount)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 20)
                .map(([cls, count]) => ({ class: cls, count }));
            
            return info;
        });
        
        console.log(`[INSPECT] 📊 Estructura encontrada:`);
        console.log(`[INSPECT] - Título: ${pageInfo.title}`);
        console.log(`[INSPECT] - Data-testids encontrados: ${pageInfo.dataTestIds.length}`);
        console.log(`[INSPECT] - Posibles contenedores de anuncios: ${pageInfo.possibleAdContainers.length}`);
        
        return pageInfo;
        
    } catch (error) {
        console.error(`[INSPECT] ❌ Error inspeccionando:`, error.message);
        throw error;
    } finally {
        if (page) await page.close();
    }
}

// Función para hacer scraping profesional usando Apify
async function scrapeAdsLibraryWithApify(searchTerms, country = 'CO', adType = 'ALL', maxAds = 200, minDays = 0) {
    console.log(`[APIFY] 🚀 Iniciando scraping profesional con Apify...`);
    
    const apifyToken = process.env.APIFY_API_TOKEN;
    if (!apifyToken) {
        throw new Error('APIFY_API_TOKEN requerido en variables de entorno');
    }
    
    try {
        // Inicializar cliente de Apify
        const client = new ApifyClient({
            token: apifyToken,
        });
        
        // Construir URL de Facebook Ads Library con filtro de días
        const baseUrl = 'https://www.facebook.com/ads/library/';
        const params = new URLSearchParams({
            active_status: 'active', // Solo anuncios activos
            ad_type: adType.toLowerCase(),
            country: country,
            is_targeted_country: 'false', // Para búsquedas globales
            media_type: 'all',
            q: searchTerms, // URLSearchParams codifica automáticamente los espacios como %20
            search_type: 'keyword_unordered'
        });
        
        // Aplicar filtro de días mínimos si se especifica
        // Usar start_date[max] en lugar de ad_delivery_date_max (formato correcto de Facebook)
        if (minDays > 0) {
            const today = new Date();
            const maxDate = new Date(today);
            maxDate.setDate(today.getDate() - minDays);
            
            // Formato YYYY-MM-DD para Facebook Ads Library
            const maxDateString = maxDate.toISOString().split('T')[0];
            params.set('start_date[max]', maxDateString);
            
            console.log(`[APIFY] 📅 Filtro aplicado: Solo anuncios iniciados antes de ${maxDateString} (mínimo ${minDays} días corriendo)`);
            console.log(`[APIFY] 💡 Lógica: active_status=active + start_date[max]=${maxDateString} = anuncios activos con ${minDays}+ días corriendo`);
        }
        
        const searchUrl = `${baseUrl}?${params.toString()}`;
        console.log(`[APIFY] 📍 URL a scrapear: ${searchUrl}`);
        
        // Configurar input para el actor de Apify
        const input = {
            urls: [
                {
                    url: searchUrl
                }
            ],
            count: maxAds,
            period: "",
            "scrapePageAds.activeStatus": "all",
            "scrapePageAds.countryCode": country || "ALL"
        };
        
        console.log(`[APIFY] ⚙️ Ejecutando actor de Facebook Ads Library...`);
        
        // Ejecutar el actor y esperar resultados
        const run = await client.actor("XtaWFhbtfxyzqrFmd").call(input);
        
        console.log(`[APIFY] ⏳ Actor ejecutado, obteniendo resultados...`);
        
        // Obtener resultados del dataset
        const { items } = await client.dataset(run.defaultDatasetId).listItems();
        
        // Procesar y normalizar los datos para compatibilidad con la API
        const processedAds = items.map((item, index) => {
            // Calcular días corriendo desde start_date
            let daysRunning = 0;
            let isLongRunning = false;
            let startDate = null;
            let endDate = null;
            
            if (item.start_date) {
                startDate = new Date(item.start_date * 1000); // Unix timestamp a Date
                const today = new Date();
                const diffTime = Math.abs(today - startDate);
                daysRunning = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                isLongRunning = daysRunning > 30;
            }
            
            if (item.end_date) {
                endDate = new Date(item.end_date * 1000); // Unix timestamp a Date
            }
            
            // Extraer información del snapshot
            const snapshot = item.snapshot || {};
            const body = snapshot.body || {};
            
            // DEBUG: Mostrar estructura real de los primeros items
            if (index < 2) {
                console.log(`[APIFY] 🔍 DEBUG Item ${index}:`, {
                    ad_archive_id: item.ad_archive_id,
                    page_name: item.page_name,
                    snapshot_keys: Object.keys(snapshot),
                    collation_count: item.collation_count,
                    total_active_time: item.total_active_time,
                    has_images: snapshot.images?.length > 0,
                    has_videos: snapshot.videos?.length > 0
                });
            }
            
            return {
                id: item.ad_archive_id || `apify_${Date.now()}_${index}`,
                source: 'apify_scraping',
                scraped: true,
                
                // Campos básicos desde Apify
                page_name: item.page_name || snapshot.page_name || snapshot.current_page_name || 'Página no disponible',
                page_id: item.page_id || snapshot.page_id || 'N/A',
                
                // Contenido creativo desde snapshot
                ad_creative_bodies: body.text ? [body.text] : [],
                ad_creative_link_captions: snapshot.caption ? [snapshot.caption] : [],
                ad_creative_link_descriptions: snapshot.link_description ? [snapshot.link_description] : [],
                ad_creative_link_titles: snapshot.title ? [snapshot.title] : [],
                
                // Fechas formateadas
                ad_creation_time: startDate ? startDate.toISOString() : null,
                ad_delivery_start_time: startDate ? startDate.toISOString() : null,
                ad_delivery_stop_time: endDate ? endDate.toISOString() : null,
                
                // URLs y plataformas
                ad_snapshot_url: item.ad_library_url || '',
                publisher_platforms: item.publisher_platform || [],
                languages: [], // No disponible directamente en esta estructura
                
                // Campos adicionales específicos de Apify
                impressions: item.impressions_with_index?.impressions_text ? 
                    { lower_bound: item.impressions_with_index.impressions_text, upper_bound: item.impressions_with_index.impressions_text } : 
                    { lower_bound: 'N/A', upper_bound: 'N/A' },
                spend: item.spend ? 
                    { lower_bound: item.spend, currency: item.currency || 'N/A' } : 
                    { lower_bound: 'N/A', currency: item.currency || 'N/A' },
                currency: item.currency || 'N/A',
                
                // Campos calculados de días corriendo
                days_running: daysRunning,
                is_long_running: isLongRunning,
                is_indefinite: !endDate,
                is_active: item.is_active || false,
                total_active_time: item.total_active_time || 0,
                
                // Campos para calcular "calor" del producto
                collation_count: item.collation_count || 1,
                hotness_score: calculateHotnessScore(item.collation_count || 1, daysRunning),
                
                // Información enriquecida única de Apify
                apify_data: {
                    // URLs de archivos multimedia
                    ad_library_url: item.ad_library_url,
                    page_profile_uri: snapshot.page_profile_uri,
                    link_url: snapshot.link_url,
                    
                    // Información visual
                    images: snapshot.images || [],
                    videos: snapshot.videos || [],
                    page_profile_picture_url: snapshot.page_profile_picture_url,
                    video_preview_image_url: snapshot.videos?.[0]?.video_preview_image_url,
                    
                    // Información de la página
                    page_categories: snapshot.page_categories || [],
                    page_like_count: snapshot.page_like_count || 0,
                    ig_followers: 0, // No disponible en estructura actual
                    ig_username: null, // No disponible en estructura actual
                    page_verification: false, // No disponible en estructura actual
                    
                    // Información del anuncio
                    display_format: snapshot.display_format,
                    cta_text: snapshot.cta_text,
                    cta_type: snapshot.cta_type,
                    reach_estimate: item.reach_estimate,
                    contains_sensitive_content: item.contains_sensitive_content,
                    
                    // Fechas formateadas
                    start_date_formatted: item.start_date_formatted,
                    end_date_formatted: item.end_date_formatted,
                    
                    // Metadatos
                    total_ads_from_page: item.total,
                    ads_count: item.ads_count,
                    entity_type: item.entity_type,
                    gated_type: item.gated_type,
                    
                    // Item original completo para debugging
                    original_item: item
                }
            };
        });
        
        console.log(`[APIFY] ✅ Scraping profesional completado: ${processedAds.length} anuncios extraídos`);
        console.log(`[APIFY] 📊 Datos enriquecidos con información adicional de Apify`);
        
        return processedAds;
        
    } catch (error) {
        console.error(`[APIFY] ❌ Error en scraping con Apify:`, error.message);
        throw error;
    }
}

// Función para hacer scraping alternativo usando bibliotecas públicas
async function scrapeAdsLibrary(searchTerms, country = 'CO', adType = 'ALL', maxAds = 200) {
    console.log(`[SCRAPING] 🕷️ ADVERTENCIA: Facebook Ads Library requiere autenticación para scraping completo`);
    console.log(`[SCRAPING] 💡 Usando método alternativo: Combinando API + búsquedas específicas...`);
    
    // Primero intentar con la API para obtener datos base
    const token = process.env.FACEBOOK_ACCESS_TOKEN;
    if (!token) {
        throw new Error('Token de Facebook requerido para scraping alternativo');
    }
    
    try {
        // Realizar múltiples búsquedas con variaciones para obtener más resultados
        const searchVariations = [
            searchTerms,
            searchTerms.split(' ')[0], // Primera palabra
            searchTerms.replace(/\s+/g, ' ').trim(), // Limpiar espacios
            searchTerms + ' colombia', // Agregar país
            searchTerms + ' oferta', // Agregar términos comerciales
            searchTerms + ' descuento'
        ];
        
        const allAds = new Set(); // Usar Set para evitar duplicados
        
        for (const variation of searchVariations) {
            try {
                console.log(`[SCRAPING] 🔍 Búsqueda variación: "${variation}"`);
                
                const searchParams = `ad_type=ALL&ad_active_status=ACTIVE&limit=500&fields=id,ad_creation_time,ad_delivery_start_time,ad_delivery_stop_time,ad_creative_bodies,ad_creative_link_captions,ad_creative_link_descriptions,ad_creative_link_titles,ad_snapshot_url,languages,page_id,page_name,publisher_platforms&search_terms=${encodeURIComponent(variation)}&search_type=KEYWORD_UNORDERED&ad_reached_countries=['${country}']&is_targeted_country=false`;
                
                const endpoint = `https://graph.facebook.com/v21.0/ads_archive?${searchParams}&access_token=${token}`;
                
                const response = await fetch(endpoint);
                const data = await response.json();
                
                if (data.data) {
                    data.data.forEach(ad => {
                        // Marcar como scraping alternativo
                        ad.source = 'enhanced_api_scraping';
                        ad.searchVariation = variation;
                        ad.scraped = true;
                        allAds.add(JSON.stringify(ad)); // Usar JSON para comparación
                    });
                    
                    console.log(`[SCRAPING] ✅ Variación "${variation}": ${data.data.length} anuncios`);
                } else if (data.error) {
                    console.log(`[SCRAPING] ⚠️ Error en variación "${variation}": ${data.error.message}`);
                }
                
                // Pausa entre búsquedas para evitar rate limiting
                await new Promise(resolve => setTimeout(resolve, 1000));
                
            } catch (error) {
                console.log(`[SCRAPING] ❌ Error en variación "${variation}": ${error.message}`);
            }
        }
        
        // Convertir Set de vuelta a array de objetos
        const uniqueAds = Array.from(allAds).map(adStr => JSON.parse(adStr));
        
        // Ordenar por fecha de creación más reciente
        uniqueAds.sort((a, b) => {
            const dateA = new Date(a.ad_creation_time || 0);
            const dateB = new Date(b.ad_creation_time || 0);
            return dateB - dateA;
        });
        
        // Limitar resultados
        const finalAds = uniqueAds.slice(0, maxAds);
        
        console.log(`[SCRAPING] 🎯 Scraping alternativo completado: ${finalAds.length} anuncios únicos encontrados`);
        console.log(`[SCRAPING] 📊 De ${uniqueAds.length} anuncios totales encontrados en ${searchVariations.length} búsquedas`);
        
        return finalAds;
        
    } catch (error) {
        console.error(`[SCRAPING] ❌ Error en scraping alternativo:`, error.message);
        throw error;
    }
}

// Función optimizada para capturar screenshots en lotes
async function captureScreenshotsBatch(ads, batchSize = 10) {
    const adsWithSnapshots = ads.filter(ad => ad.ad_snapshot_url);
    const totalBatches = Math.ceil(adsWithSnapshots.length / batchSize);
    
    console.log(`[SCREENSHOT] Iniciando captura RÁPIDA por lotes: ${adsWithSnapshots.length} anuncios en ${totalBatches} lotes de ${batchSize}`);
    
    try {
        const browser = await getSharedBrowser();
        
        for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
            const startIndex = batchIndex * batchSize;
            const endIndex = Math.min(startIndex + batchSize, adsWithSnapshots.length);
            const batch = adsWithSnapshots.slice(startIndex, endIndex);
            
            console.log(`[SCREENSHOT] Procesando lote ${batchIndex + 1}/${totalBatches} (anuncios ${startIndex + 1}-${endIndex})`);
            
            // Crear múltiples páginas en paralelo para el lote
            const batchPromises = batch.map(async (ad) => {
                const screenshotPath = path.join(__dirname, 'screenshots', `${ad.id}.png`);
                
                // Verificar si ya existe
                if (fs.existsSync(screenshotPath)) {
                    return { id: ad.id, status: 'exists' };
                }
                
                let page;
                try {
                    page = await browser.newPage();
                    
                    // Configuración optimizada de página
                    await Promise.all([
                        page.setViewport({ width: 1200, height: 800, deviceScaleFactor: 1 }),
                        page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'),
                        page.setExtraHTTPHeaders({
                            'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
                            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
                        }),
                        // Bloquear recursos innecesarios para velocidad
                        page.setRequestInterception(true)
                    ]);

                    // Interceptar y bloquear recursos pesados
                    page.on('request', (request) => {
                        const resourceType = request.resourceType();
                        if (['font', 'media', 'other'].includes(resourceType)) {
                            request.abort();
                        } else {
                            request.continue();
                        }
                    });

                    // Navegar con timeout más corto
                    await page.goto(ad.ad_snapshot_url, { 
                        waitUntil: 'domcontentloaded',
                        timeout: 20000 
                    });

                    // Scroll optimizado más rápido
                    await page.evaluate(() => {
                        return new Promise((resolve) => {
                            let totalHeight = 0;
                            const distance = 200; // Mayor distancia = más rápido
                            const timer = setInterval(() => {
                                const scrollHeight = document.body.scrollHeight;
                                window.scrollBy(0, distance);
                                totalHeight += distance;
                                if(totalHeight >= scrollHeight){
                                    clearInterval(timer);
                                    resolve();
                                }
                            }, 50); // Intervalo más corto = más rápido
                        });
                    });

                    // Espera más corta
                    await new Promise(resolve => setTimeout(resolve, 1500));

                    // Screenshot optimizado
                    await page.screenshot({
                        path: screenshotPath,
                        type: 'png',
                        fullPage: true,
                        optimizeForSpeed: true
                    });

                    return { id: ad.id, status: 'success' };
                    
                } catch (error) {
                    return { id: ad.id, status: 'error', error: error.message };
                } finally {
                    if (page) {
                        await page.close();
                    }
                }
            });
            
            // Procesar lote y mostrar resultados
            const results = await Promise.all(batchPromises);
            const successful = results.filter(r => r.status === 'success').length;
            const existing = results.filter(r => r.status === 'exists').length;
            const errors = results.filter(r => r.status === 'error').length;
            
            console.log(`[SCREENSHOT] Lote ${batchIndex + 1} completado: ${successful} nuevos, ${existing} existentes, ${errors} errores`);
            
            // Pausa más corta entre lotes
            if (batchIndex < totalBatches - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        console.log(`[SCREENSHOT] ✅ Captura RÁPIDA completada - Browser manteniéndose activo para siguientes capturas`);
        
    } catch (error) {
        console.error(`[ERROR] Error en captura por lotes:`, error.message);
        // Si hay error, cerrar y resetear browser
        if (globalBrowser) {
            await globalBrowser.close();
            globalBrowser = null;
        }
    }
}

app.post('/api/search', async (req, res) => {
    const { searchType, value, country, minDays, url, dateFrom, dateTo, adType, mediaType, languages, platforms, searchPhraseType, singlePage, useWebScraping, useApify, apifyCount, autoSaveComplete, completeName } = req.body;
    const token = process.env.FACEBOOK_ACCESS_TOKEN;
    if (!token) return res.status(500).json({ message: 'Token de acceso no configurado en el servidor.' });
    
    // Declarar minDaysNumber temprano para usarlo en toda la función
    const minDaysNumber = parseInt(minDays) || 0;
    
    // Campos dinámicos según el tipo de anuncio
    let searchFields;
    if (adType === 'POLITICAL_AND_ISSUE_ADS') {
        // Campos completos para anuncios políticos (incluye métricas)
        searchFields = 'id,ad_creation_time,ad_delivery_start_time,ad_delivery_stop_time,ad_creative_bodies,ad_creative_link_captions,ad_creative_link_descriptions,ad_creative_link_titles,ad_snapshot_url,languages,page_id,page_name,publisher_platforms,impressions,spend,currency,demographic_distribution,estimated_audience_size';
    } else {
        // Campos para anuncios no políticos (sin métricas)
        searchFields = 'id,ad_creation_time,ad_delivery_start_time,ad_delivery_stop_time,ad_creative_bodies,ad_creative_link_captions,ad_creative_link_descriptions,ad_creative_link_titles,ad_snapshot_url,languages,page_id,page_name,publisher_platforms';
    }
    let endpoint;
    let searchParams = '';
    let selectedAdType = 'ALL';

    if (url) {
        endpoint = url;
    } else {
        // Usar el tipo de anuncio seleccionado o ALL por defecto
        selectedAdType = adType || 'ALL';
        searchParams = `ad_type=${selectedAdType}&ad_active_status=ACTIVE&limit=100&fields=${searchFields}`;
        
        // Búsqueda por keyword o página
        if (searchType === 'keyword') {
            // Formato mejorado para coincidir con Facebook Library (sin comillas extras)
            searchParams += `&search_terms=${encodeURIComponent(value)}`;
            // Tipo de búsqueda: exacta o por palabras separadas
            if (searchPhraseType === 'exact') {
                searchParams += `&search_type=KEYWORD_EXACT_PHRASE`;
            } else {
                searchParams += `&search_type=KEYWORD_UNORDERED`;
            }
        } else {
            searchParams += `&search_page_ids=[${value}]`;
        }
        
        // Filtro de país (mejorado para coincidir con Facebook Library)
        if (country && country !== 'ALL') {
             searchParams += `&ad_reached_countries=['${country}']`;
             // Agregar parámetro para incluir anuncios no dirigidos específicamente al país
             searchParams += `&is_targeted_country=false`;
        } else {
            // Cambiar default a Colombia en lugar de US para coincidir con tu búsqueda
            searchParams += `&ad_reached_countries=['CO']`;
            searchParams += `&is_targeted_country=false`;
        }
        
        // Filtros de fecha (MUY ÚTIL para anuncios de larga duración)
        // Usar parámetros oficiales de Facebook API
        if (dateFrom) {
            searchParams += `&ad_delivery_date_min=${dateFrom}`;
        }
        if (dateTo) {
            searchParams += `&ad_delivery_date_max=${dateTo}`;
        }
        
        // Filtro inteligente de días mínimos (similar a Apify)
        // Modifica la búsqueda en lugar de filtrar después
        if (minDaysNumber > 0 && !dateTo) { // Solo aplicar si no hay dateTo manual
            const today = new Date();
            const maxDate = new Date(today);
            maxDate.setDate(today.getDate() - minDaysNumber);
            
            // Formato YYYY-MM-DD para Facebook Ads Library (parámetro oficial)
            const maxDateString = maxDate.toISOString().split('T')[0];
            searchParams += `&ad_delivery_date_max=${maxDateString}`;
            
            console.log(`[API] 📅 Filtro inteligente aplicado: Solo anuncios entregados antes de ${maxDateString} (mínimo ${minDaysNumber} días corriendo)`);
            console.log(`[API] 💡 Lógica: active_status=active + ad_delivery_date_max=${maxDateString} = anuncios activos con ${minDaysNumber}+ días corriendo`);
        }
        
        // Filtro de tipo de media
        if (mediaType && mediaType !== 'ALL') {
            searchParams += `&media_type=${mediaType}`;
        }
        
        // Filtro de idiomas
        if (languages && languages.length > 0) {
            const languageArray = languages.map(lang => `'${lang}'`).join(',');
            searchParams += `&languages=[${languageArray}]`;
        }
        
        // Filtro de plataformas
        if (platforms && platforms.length > 0) {
            const platformArray = platforms.map(platform => `'${platform}'`).join(',');
            searchParams += `&publisher_platforms=[${platformArray}]`;
        }
        
        endpoint = `https://graph.facebook.com/v21.0/ads_archive?${searchParams}&access_token=${token}`;
    }

    // Modo debug: mostrar la URL generada (sin el token por seguridad)
    if (url) {
        console.log(`[DEBUG] Usando URL directa: ${url}`);
    } else {
        console.log(`[DEBUG] URL generada: https://graph.facebook.com/v21.0/ads_archive?${searchParams}&access_token=***`);
        console.log(`[DEBUG] Parámetros de búsqueda:`);
        console.log(`  - Tipo de anuncio: ${selectedAdType}`);
        console.log(`  - País: ${country || 'CO (default)'}`);
        console.log(`  - Términos: ${value}`);
        console.log(`  - Tipo de búsqueda: ${searchPhraseType || 'unordered'}`);
        console.log(`  - Fecha desde: ${dateFrom || 'N/A'}`);
        console.log(`  - Fecha hasta: ${dateTo || 'N/A'}`);
        console.log(`  - Días mínimos: ${minDaysNumber > 0 ? `${minDaysNumber} días (filtro inteligente aplicado)` : 'N/A'}`);
        console.log(`  - Tipo de media: ${mediaType || 'ALL'}`);
        console.log(`  - Idiomas: ${languages ? languages.join(',') : 'N/A'}`);
        console.log(`  - Plataformas: ${platforms ? platforms.join(',') : 'N/A'}`);
    }

    try {
        let data;
        
        // Usar Apify si se solicita
        if (useApify && searchType === 'keyword' && !url) {
            console.log(`[INFO] 🚀 Usando APIFY para scraping profesional...`);
            
            // Limpiar carpeta de screenshots antes del scraping
            try {
                const screenshotsDir = path.join(__dirname, 'screenshots');
                if (fs.existsSync(screenshotsDir)) {
                    const files = fs.readdirSync(screenshotsDir);
                    for (const file of files) {
                        if (file.endsWith('.png')) {
                            fs.unlinkSync(path.join(screenshotsDir, file));
                        }
                    }
                    console.log(`[INFO] Carpeta de screenshots limpiada: ${files.filter(f => f.endsWith('.png')).length} archivos eliminados`);
                }
            } catch (error) {
                console.log(`[WARNING] No se pudo limpiar la carpeta de screenshots: ${error.message}`);
            }
            
            // Hacer scraping con Apify
            const minDaysNumber = parseInt(minDays) || 0;
            const maxAdsToScrape = parseInt(apifyCount) || 100;
            
            // Advertencia si el filtro de días es muy alto (para evitar gastos innecesarios)
            if (minDaysNumber > 10) {
                console.log(`[WARNING] ⚠️ Filtro de ${minDaysNumber} días es muy alto. La mayoría de anuncios de Apify tienen 1-10 días. Considera usar un filtro más bajo.`);
            }
            
            const scrapedAds = await scrapeAdsLibraryWithApify(value, country || 'CO', adType || 'ALL', maxAdsToScrape, minDaysNumber);
            
            data = {
                data: scrapedAds,
                totalPages: 1,
                totalAds: scrapedAds.length,
                paging: null,
                source: 'apify_scraping',
                message: `Scraping profesional completado: ${scrapedAds.length} anuncios extraídos con Apify${minDaysNumber > 0 ? ` (mínimo ${minDaysNumber} días corriendo)` : ''}`
            };
            
            // AUTO-GUARDAR búsqueda completa de Apify (evitar re-ejecutar costoso)
            if (scrapedAds.length > 0) {
                try {
                    const searchName = completeName || `Apify-${value}-${country || 'CO'}-${new Date().toISOString().split('T')[0]}`;
                    
                    // Verificar si ya existe
                    const existingComplete = await db.collection('completeSearches').findOne({ searchName: searchName });
                    
                    if (!existingComplete) {
                        const completeSearchData = {
                            searchName: searchName,
                            searchParams: {
                                searchType, value, country, minDays, dateFrom, dateTo, 
                                adType, mediaType, languages, platforms, searchPhraseType, 
                                useApify: true, apifyCount: maxAdsToScrape
                            },
                            executedAt: new Date(),
                            source: 'apify_scraping',
                            totalResults: scrapedAds.length,
                            results: scrapedAds,
                            metadata: {
                                country: country || 'CO',
                                searchTerm: value,
                                minDays: minDaysNumber,
                                adType: adType || 'ALL',
                                useApify: true,
                                apifyCount: maxAdsToScrape
                            },
                            stats: {
                                avgHotnessScore: scrapedAds.length > 0 ? scrapedAds.reduce((sum, ad) => sum + (ad.hotness_score || 0), 0) / scrapedAds.length : 0,
                                longRunningAds: scrapedAds.filter(ad => ad.is_long_running).length,
                                topPages: [...new Set(scrapedAds.map(ad => ad.page_name))].slice(0, 10)
                            },
                            lastAccessed: new Date(),
                            accessCount: 1
                        };
                        
                        await db.collection('completeSearches').insertOne(completeSearchData);
                        
                        data.autoSaved = {
                            saved: true,
                            searchName: searchName,
                            message: `💰 Búsqueda Apify guardada automáticamente - Reutilizable sin costo adicional`
                        };
                        
                        console.log(`[AUTO_SAVE] ✅ Búsqueda Apify auto-guardada: "${searchName}" con ${scrapedAds.length} anuncios`);
                    } else {
                        data.autoSaved = {
                            saved: false,
                            message: `Búsqueda ya existe: "${searchName}"`
                        };
                    }
                } catch (saveError) {
                    console.error(`[AUTO_SAVE] ❌ Error auto-guardando: ${saveError.message}`);
                    data.autoSaved = {
                        saved: false,
                        message: 'Error al auto-guardar búsqueda'
                    };
                }
            }
            
        } else if (useWebScraping && searchType === 'keyword' && !url) {
            console.log(`[INFO] 🕷️ Usando WEB SCRAPING para mayor cobertura...`);
            
            // Limpiar carpeta de screenshots antes del scraping
            try {
                const screenshotsDir = path.join(__dirname, 'screenshots');
                if (fs.existsSync(screenshotsDir)) {
                    const files = fs.readdirSync(screenshotsDir);
                    for (const file of files) {
                        if (file.endsWith('.png')) {
                            fs.unlinkSync(path.join(screenshotsDir, file));
                        }
                    }
                    console.log(`[INFO] Carpeta de screenshots limpiada: ${files.filter(f => f.endsWith('.png')).length} archivos eliminados`);
                }
            } catch (error) {
                console.log(`[WARNING] No se pudo limpiar la carpeta de screenshots: ${error.message}`);
            }
            
            // Hacer scraping de la web
            const scrapedAds = await scrapeAdsLibrary(value, country || 'CO', adType || 'ALL', 300);
            
            data = {
                data: scrapedAds,
                totalPages: 1,
                totalAds: scrapedAds.length,
                paging: null,
                source: 'enhanced_api_scraping',
                message: `Búsqueda inteligente completada: ${scrapedAds.length} anuncios únicos encontrados`
            };
            
        } else if (singlePage) {
            // Modo página única (para paginación manual)
            const fbResponse = await fetch(endpoint);
            data = await fbResponse.json();
            if (data.error) throw new Error(JSON.stringify(data.error));
            data.source = 'facebook_api';
        } else {
            // Modo automático: obtener 10 páginas
            console.log(`[INFO] Iniciando búsqueda automática de 10 páginas via API...`);
            
            // Limpiar carpeta de screenshots antes de la búsqueda
            try {
                const screenshotsDir = path.join(__dirname, 'screenshots');
                if (fs.existsSync(screenshotsDir)) {
                    const files = fs.readdirSync(screenshotsDir);
                    for (const file of files) {
                        if (file.endsWith('.png')) {
                            fs.unlinkSync(path.join(screenshotsDir, file));
                        }
                    }
                    console.log(`[INFO] Carpeta de screenshots limpiada: ${files.filter(f => f.endsWith('.png')).length} archivos eliminados`);
                }
            } catch (error) {
                console.log(`[WARNING] No se pudo limpiar la carpeta de screenshots: ${error.message}`);
            }
            
            data = await fetchMultiplePages(endpoint, 10);
            data.source = 'facebook_api';
        }
        
        // Aplicar filtro de días mínimos posterior solo para casos especiales
        // (Apify con timestamps incorrectos o cuando no se pudo aplicar filtro inteligente)
        const minDaysNumber = parseInt(minDays) || 0;
        const needsPostFiltering = minDaysNumber > 0 && data.data && (
            // Solo aplicar filtro posterior si:
            data.source === 'apify_scraping' || // Datos de Apify (pueden tener timestamps incorrectos)
            (dateTo && minDaysNumber > 0) || // Se especificó dateTo manual (conflicto con filtro inteligente)
            url // Se usó URL directa (no se pudo aplicar filtro inteligente)
        );
        
        if (needsPostFiltering) {
            const originalCount = data.data.length;
            const today = new Date();
            data.data = data.data.filter(ad => {
                if (!ad.ad_delivery_start_time) return false;
                
                const startDate = new Date(ad.ad_delivery_start_time);
                const diffTime = Math.abs(today - startDate);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                // Si la fecha es en el futuro (datos de Apify con timestamps incorrectos),
                // usar total_active_time como fallback
                if (startDate > today && ad.total_active_time) {
                    const daysFromActiveTime = Math.floor(ad.total_active_time / (24 * 60 * 60)); // Convertir segundos a días
                    console.log(`[FILTER] 📊 Anuncio ${ad.ad_archive_id}: ${daysFromActiveTime} días (fallback) vs ${minDaysNumber} mínimo - ${daysFromActiveTime >= minDaysNumber ? '✅ PASA' : '❌ NO PASA'}`);
                    return daysFromActiveTime >= minDaysNumber;
                }
                
                console.log(`[FILTER] 📊 Anuncio ${ad.ad_archive_id || ad.id}: ${diffDays} días vs ${minDaysNumber} mínimo - ${diffDays >= minDaysNumber ? '✅ PASA' : '❌ NO PASA'}`);
                
                return diffDays >= minDaysNumber;
            });
            console.log(`[FILTER] 🎯 FILTRO POSTERIOR: ${originalCount} anuncios -> ${data.data.length} anuncios (mínimo ${minDaysNumber} días)`);
        } else if (minDaysNumber > 0) {
            console.log(`[FILTER] ✅ Filtro inteligente aplicado en consulta - Sin necesidad de filtro posterior`);
        }

        if (data.data) {
            // Calcular hotness_score para anuncios que no lo tengan (no-Apify)
            data.data.forEach(ad => {
                if (!ad.hotness_score) {
                    const collationCount = ad.collation_count || 1;
                    const daysRunning = ad.days_running || 0;
                    ad.hotness_score = calculateHotnessScore(collationCount, daysRunning);
                }
            });
            
            // Ordenar por hotness_score (más calientes primero)
            data.data.sort((a, b) => {
                // Primero por hotness_score (descendente)
                if (b.hotness_score !== a.hotness_score) {
                    return b.hotness_score - a.hotness_score;
                }
                // Si tienen el mismo score, ordenar por collation_count
                if (b.collation_count !== a.collation_count) {
                    return (b.collation_count || 0) - (a.collation_count || 0);
                }
                // Finalmente por días corriendo
                return (b.days_running || 0) - (a.days_running || 0);
            });
            
            // Mostrar top 5 anuncios más calientes para debug
            const top5 = data.data.slice(0, 5);
            console.log(`[SORT] 🔥 Top 5 anuncios más calientes:`);
            top5.forEach((ad, index) => {
                console.log(`[SORT] ${index + 1}. ${getFlameEmoji(ad.hotness_score)} ${ad.page_name} - Score: ${ad.hotness_score}/5 (${ad.collation_count} variaciones, ${ad.days_running} días)`);
            });
            
            console.log(`[SORT] 🔥 Total anuncios ordenados por temperatura: ${data.data.length}`);
            
            // Contar tipos de fuente para optimización
            const apifyAds = data.data.filter(ad => ad.source === 'apify_scraping').length;
            const apiAds = data.data.filter(ad => ad.source === 'facebook_api').length;
            const scrapingAds = data.data.filter(ad => ad.source === 'web_scraping').length;
            
            // Analizar anuncios de Apify para ver cuáles tienen media
            const apifyWithImages = data.data.filter(ad => 
                ad.source === 'apify_scraping' && 
                ad.apify_data && 
                ad.apify_data.images && 
                ad.apify_data.images.length > 0
            ).length;
            
            const apifyWithVideos = data.data.filter(ad => 
                ad.source === 'apify_scraping' && 
                ad.apify_data && 
                ad.apify_data.videos && 
                ad.apify_data.videos.length > 0
            ).length;
            
            const apifyTextOnly = data.data.filter(ad => 
                ad.source === 'apify_scraping' && 
                (!ad.apify_data || 
                 (!ad.apify_data.images || ad.apify_data.images.length === 0) &&
                 (!ad.apify_data.videos || ad.apify_data.videos.length === 0))
            ).length;
            
            console.log(`[OPTIMIZATION] 📊 Distribución de fuentes:`);
            console.log(`[OPTIMIZATION] ⚡ Apify TOTAL: ${apifyAds} anuncios`);
            console.log(`[OPTIMIZATION]   📸 Con imágenes: ${apifyWithImages} anuncios`);
            console.log(`[OPTIMIZATION]   🎥 Con videos: ${apifyWithVideos} anuncios`);
            console.log(`[OPTIMIZATION]   📄 Solo texto: ${apifyTextOnly} anuncios`);
            console.log(`[OPTIMIZATION] 🔌 Facebook API: ${apiAds} anuncios`);
            console.log(`[OPTIMIZATION] 🕷️ Web Scraping (con Puppeteer): ${scrapingAds} anuncios`);
            
            // Debug: Mostrar anuncios de Apify sin media (para debugging)
            if (apifyTextOnly > 0) {
                console.log(`[DEBUG] 🔍 Anuncios de Apify SIN imágenes/videos (${apifyTextOnly}):`);
                data.data.filter(ad => 
                    ad.source === 'apify_scraping' && 
                    (!ad.apify_data || 
                     (!ad.apify_data.images || ad.apify_data.images.length === 0) &&
                     (!ad.apify_data.videos || ad.apify_data.videos.length === 0))
                ).slice(0, 3).forEach((ad, index) => {
                    console.log(`[DEBUG] ${index + 1}. ${ad.page_name} (ID: ${ad.ad_archive_id})`);
                });
            }
            
            data.data.forEach(ad => {
                // Campos básicos (establecer valores por defecto)
                ad.id = ad.id || 'N/A';
                ad.page_id = ad.page_id || 'N/A';
                ad.page_name = ad.page_name || 'Página sin nombre';
                
                // Textos creativos
                if (!ad.ad_creative_bodies || ad.ad_creative_bodies.length === 0) {
                    ad.ad_creative_bodies = ['Sin texto de anuncio.'];
                }
                
                // Campos de enlaces creativos
                ad.ad_creative_link_captions = ad.ad_creative_link_captions || [];
                ad.ad_creative_link_descriptions = ad.ad_creative_link_descriptions || [];
                ad.ad_creative_link_titles = ad.ad_creative_link_titles || [];
                
                // Campos de plataforma e idioma
                ad.languages = ad.languages || [];
                ad.publisher_platforms = ad.publisher_platforms || [];
                
                // URL del snapshot
                ad.ad_snapshot_url = ad.ad_snapshot_url || '';
                
                // Campos de fechas
                ad.ad_creation_time = ad.ad_creation_time || null;
                ad.ad_delivery_start_time = ad.ad_delivery_start_time || null;
                ad.ad_delivery_stop_time = ad.ad_delivery_stop_time || null;
                
                // Calcular días corriendo (útil para identificar anuncios de larga duración)
                if (ad.ad_delivery_start_time) {
                    const startDate = new Date(ad.ad_delivery_start_time);
                    const today = new Date();
                    const diffTime = Math.abs(today - startDate);
                    const daysRunning = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    ad.days_running = daysRunning;
                    
                    // Marcar como "larga duración" si lleva más de 30 días
                    ad.is_long_running = daysRunning > 30;
                    
                    // Marcar como "sin fecha de stop" si no tiene fecha de finalización
                    ad.is_indefinite = !ad.ad_delivery_stop_time;
                } else {
                    ad.days_running = 0;
                    ad.is_long_running = false;
                    ad.is_indefinite = true;
                }
                
                // Agregar información de "calor" del producto
                ad.collation_count = ad.collation_count || 1;
                if (!ad.hotness_score) {
                    ad.hotness_score = calculateHotnessScore(ad.collation_count, ad.days_running);
                }
                ad.flame_emoji = getFlameEmoji(ad.hotness_score);
                
                // Manejar métricas según el tipo de anuncio
                if (adType === 'POLITICAL_AND_ISSUE_ADS') {
                    // Para anuncios políticos, usar las métricas reales si están disponibles
                    ad.impressions = ad.impressions || { lower_bound: 'N/A', upper_bound: 'N/A' };
                    ad.spend = ad.spend || { lower_bound: 'N/A', currency: '' };
                    ad.currency = ad.currency || 'N/A';
                    ad.demographic_distribution = ad.demographic_distribution || [];
                    ad.estimated_audience_size = ad.estimated_audience_size || null;
                } else {
                    // Para anuncios no políticos, establecer como N/A
                    ad.impressions = { lower_bound: 'N/A', upper_bound: 'N/A', note: 'Solo disponible para anuncios políticos' };
                    ad.spend = { lower_bound: 'N/A', currency: '', note: 'Solo disponible para anuncios políticos' };
                    ad.currency = 'N/A';
                    ad.demographic_distribution = [];
                    ad.estimated_audience_size = null;
                }
                
                // Campos que solo están disponibles para anuncios políticos (establecer como N/A)
                ad.age_country_gender_reach_breakdown = [];
                ad.beneficiary_payers = [];
                ad.br_total_reach = null;
                ad.bylines = null;
                ad.delivery_by_region = [];
                ad.eu_total_reach = null;
                ad.target_ages = [];
                ad.target_gender = null;
                ad.target_locations = [];
                ad.total_reach_by_location = [];
            });
        }

        // Agregar información de comparación con Facebook Library (solo si no es URL directa)
        if (!url) {
            data.facebookLibraryUrl = `https://www.facebook.com/ads/library/?active_status=active&ad_type=${selectedAdType.toLowerCase()}&country=${country || 'CO'}&is_targeted_country=false&media_type=all&q=${encodeURIComponent(value)}&search_type=keyword_unordered`;
        }
        
        // Capturar screenshots por lotes solo para búsquedas automáticas (no para paginación manual)
        if (!singlePage && data.data && data.data.length > 0) {
            console.log(`[INFO] Iniciando captura automática de screenshots por lotes...`);
            // Ejecutar en background para no bloquear la respuesta
            setImmediate(async () => {
                try {
                    await captureScreenshotsBatch(data.data, 10);
                } catch (error) {
                    console.error(`[ERROR] Error en captura por lotes:`, error.message);
                }
            });
        }
        
        // Verificar cuáles anuncios ya están guardados
        if (data.data && data.data.length > 0) {
            try {
                const adIds = data.data.map(ad => ad.id);
                const savedAds = await db.collection('savedAds').find(
                    { 'adData.id': { $in: adIds } }
                ).toArray();
                
                const savedAdIds = new Set(savedAds.map(savedAd => savedAd.adData.id));
                
                // Marcar anuncios que ya están guardados
                data.data.forEach(ad => {
                    ad.isSaved = savedAdIds.has(ad.id);
                    if (ad.isSaved) {
                        const savedAdData = savedAds.find(savedAd => savedAd.adData.id === ad.id);
                        ad.savedInfo = {
                            savedAt: savedAdData.savedAt,
                            collection: savedAdData.collection,
                            tags: savedAdData.tags,
                            isFavorite: savedAdData.isFavorite
                        };
                    }
                });
                
                const savedCount = data.data.filter(ad => ad.isSaved).length;
                if (savedCount > 0) {
                    console.log(`[SAVED_ADS] 📌 ${savedCount} de ${data.data.length} anuncios ya están guardados`);
                }
                
            } catch (error) {
                console.error(`[SAVED_ADS] ❌ Error verificando anuncios guardados: ${error.message}`);
                // No fallar la búsqueda si hay error en verificación
            }
        }
        
        res.json(data);
    } catch (error) {
        res.status(500).json({ message: 'Error al buscar anuncios', error: error.message });
    }
});

// --- Proxy para imágenes de anuncios ---
app.get('/api/proxy-image', async (req, res) => {
    const { url } = req.query;
    if (!url) {
        return res.status(400).json({ error: 'URL requerida' });
    }

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const contentType = response.headers.get('content-type') || 'image/jpeg';
        res.set('Content-Type', contentType);
        res.set('Cache-Control', 'public, max-age=3600');
        
        response.body.pipe(res);
    } catch (error) {
        console.error('Error proxy imagen:', error.message);
        res.status(500).json({ error: 'Error cargando imagen' });
    }
});

// --- Endpoint para placeholders de imágenes ---
app.get('/api/placeholder/:width/:height', (req, res) => {
    const { width, height } = req.params;
    const color = req.query.color || '374151'; // gray-700 por defecto
    
    // Crear SVG placeholder
    const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#${color}"/>
        <text x="50%" y="50%" text-anchor="middle" dy=".3em" font-family="system-ui" font-size="${Math.min(width, height) * 0.3}" fill="#9CA3AF">
            👤
        </text>
    </svg>`;
    
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache 24h
    res.send(svg);
});

// --- Screenshot RÁPIDO de anuncios con Puppeteer ---
app.get('/api/screenshot', async (req, res) => {
    const { url, adId } = req.query;
    if (!url || !adId) {
        return res.status(400).json({ error: 'URL y adId requeridos' });
    }
    
    // DEBUG: Log cuando se solicita un screenshot
    console.log(`[SCREENSHOT] 🔍 SOLICITUD: ID=${adId}, URL=${url}`);

    // Verificar si ya existe la captura
    const screenshotPath = path.join(__dirname, 'screenshots', `${adId}.png`);
    if (fs.existsSync(screenshotPath)) {
        return res.sendFile(screenshotPath);
    }

    let page;
    try {
        // Usar browser compartido para mayor velocidad
        const browser = await getSharedBrowser();

        page = await browser.newPage();
        
        // Configuración RÁPIDA en paralelo
        await Promise.all([
            page.setViewport({ width: 1200, height: 800, deviceScaleFactor: 1 }),
            page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'),
            page.setExtraHTTPHeaders({
                'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
            }),
            page.setRequestInterception(true)
        ]);

        // Bloquear recursos pesados para mayor velocidad
        page.on('request', (request) => {
            const resourceType = request.resourceType();
            if (['font', 'media', 'other'].includes(resourceType)) {
                request.abort();
            } else {
                request.continue();
            }
        });

        // Navegar RÁPIDO
        await page.goto(url, { 
            waitUntil: 'domcontentloaded',
            timeout: 20000 
        });

        // Scroll RÁPIDO
        await page.evaluate(() => {
            return new Promise((resolve) => {
                let totalHeight = 0;
                const distance = 200;
                const timer = setInterval(() => {
                    const scrollHeight = document.body.scrollHeight;
                    window.scrollBy(0, distance);
                    totalHeight += distance;
                    if(totalHeight >= scrollHeight){
                        clearInterval(timer);
                        resolve();
                    }
                }, 50);
            });
        });

        // Espera CORTA
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Screenshot OPTIMIZADO
        await page.screenshot({
            path: screenshotPath,
            type: 'png',
            fullPage: true,
            optimizeForSpeed: true
        });

        console.log(`[SCREENSHOT] ⚡ Captura RÁPIDA guardada: ${screenshotPath}`);
        res.sendFile(screenshotPath);

    } catch (error) {
        console.error(`[SCREENSHOT] Error capturando anuncio ${adId}:`, error.message);
        res.status(500).json({ error: 'Error capturando screenshot' });
    } finally {
        // NO cerrar browser - mantener activo para reutilizar
        if (page) {
            await page.close();
        }
    }
});

// --- Endpoint para inspeccionar estructura de Facebook Ads Library ---
app.get('/api/inspect-ads-library', async (req, res) => {
    const { searchTerms = 'salud', country = 'CO' } = req.query;
    
    try {
        console.log(`[API] 🔍 Iniciando inspección de Facebook Ads Library...`);
        const structureInfo = await inspectAdsLibraryStructure(searchTerms, country);
        
        res.json({
            success: true,
            data: structureInfo,
            message: 'Inspección completada exitosamente'
        });
        
    } catch (error) {
        console.error(`[API] ❌ Error en inspección:`, error.message);
        res.status(500).json({
            success: false,
            error: error.message,
            message: 'Error durante la inspección'
        });
    }
});

// --- Servir screenshots estáticamente ---
app.use('/screenshots', express.static(path.join(__dirname, 'screenshots')));

// Cerrar browser al terminar la aplicación
process.on('SIGINT', async () => {
    console.log('\n[INFO] Cerrando aplicación...');
    if (globalBrowser) {
        console.log('[INFO] Cerrando browser compartido...');
        await globalBrowser.close();
    }
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n[INFO] Cerrando aplicación...');
    if (globalBrowser) {
        console.log('[INFO] Cerrando browser compartido...');
        await globalBrowser.close();
    }
    process.exit(0);
});

// --- Iniciar Servidor ---
app.listen(port, () => {
    console.log(`Servidor escuchando en http://localhost:${port}`);
});

