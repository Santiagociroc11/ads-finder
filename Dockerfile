# 1. Usar una imagen base oficial de Node.js
FROM node:18-slim

# 2. Crear y establecer el directorio de trabajo dentro del contenedor
WORKDIR /app

# 3. Copiar los archivos de dependencias
COPY package.json package-lock.json ./

# 4. Instalar las dependencias del proyecto
RUN npm install --production

# 5. Copiar el resto de los archivos de la aplicación
COPY . .

# 6. Exponer el puerto en el que correrá la aplicación
EXPOSE 3000

# 7. El comando para iniciar la aplicación cuando se lance el contenedor
CMD [ "node", "server.js" ]
