# 🚀 Ads Finder Pro - Deploy Guide

## 📋 Requisitos Previos

- **Docker** y **Docker Compose** instalados
- **API Keys** de Facebook, Gemini y Apify

## ⚡ Deploy Rápido (1 minuto)

```bash
# 1. Configurar variables de entorno
cp env.example .env
nano .env  # Configura tus API keys

# 2. Deploy automático
./deploy.sh
```

¡Listo! La aplicación estará corriendo en **http://localhost:3000**

## 🔧 Configuración Manual

### 1. Variables de Entorno Obligatorias

Edita el archivo `.env` con tus valores:

```bash
# API Keys (OBLIGATORIAS)
FACEBOOK_ACCESS_TOKEN=tu-token-de-facebook
GEMINI_API_KEY=tu-api-key-de-gemini
APIFY_API_TOKEN=tu-token-de-apify

# JWT Secret (OBLIGATORIO)
JWT_SECRET=tu-clave-secreta-super-segura
```

### 2. Deploy Manual

```bash
# Construir y ejecutar
docker-compose up --build -d

# Ver logs
docker-compose logs -f ads-finder

# Parar servicios
docker-compose down
```

## 📊 Servicios Incluidos

- **Ads Finder App**: Puerto 3000
- **MongoDB**: Puerto 27017
- **Health Check**: http://localhost:3000/api/health

## 🔍 Comandos Útiles

```bash
# Ver logs en tiempo real
docker-compose logs -f ads-finder

# Reiniciar solo la app
docker-compose restart ads-finder

# Ver estado de servicios
docker-compose ps

# Acceder al contenedor
docker-compose exec ads-finder sh

# Backup de MongoDB
docker-compose exec mongodb mongodump --host localhost --port 27017 --out /backup

# Limpiar todo (CUIDADO: borra datos)
docker-compose down -v --rmi all
```

## 🐛 Troubleshooting

### App no inicia
```bash
# Ver logs detallados
docker-compose logs ads-finder

# Verificar variables de entorno
docker-compose exec ads-finder env | grep -E "(FACEBOOK|GEMINI|APIFY)"
```

### MongoDB no conecta
```bash
# Verificar MongoDB
docker-compose logs mongodb

# Test de conexión
docker-compose exec mongodb mongosh --eval "db.adminCommand('ping')"
```

### Memoria alta
```bash
# Ver uso de recursos
docker stats

# Reiniciar servicios
docker-compose restart
```

## 🔒 Producción

Para producción, cambia:

```bash
# En docker-compose.yml
- "3000:3000"  # Solo si necesitas acceso externo

# En .env
JWT_SECRET=clave-super-segura-de-64-caracteres-minimo
DB_PASSWORD=password-muy-seguro
NODE_ENV=production
```

## 📈 Escalabilidad

Para manejar más usuarios:

```bash
# En .env - Incrementa límites
SEARCH_RATE_LIMIT_MAX=500
MAX_BROWSERS=5
STATS_CACHE_MAX_ITEMS=10000
```

## 🎯 Arquitectura

```
┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │
│   (React)       │◄──►│   (Express)     │
│   Port: 3000    │    │   Port: 3000    │
└─────────────────┘    └─────────────────┘
                                │
                       ┌─────────────────┐
                       │    MongoDB      │
                       │   Port: 27017   │
                       └─────────────────┘
```

**¡Todo en un solo comando!** 🎉
