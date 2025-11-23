# Dockerfile pour l'API Node.js CV Parser (sans Python)
FROM node:22-bookworm-slim

# Outils minimaux (pour healthcheck avec wget)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    wget \
    curl && \
    rm -rf /var/lib/apt/lists/*

# Créer le répertoire de travail
WORKDIR /app

# (Partie Python supprimée)

# Copier les fichiers de l'API Node.js
COPY api/package*.json ./api/
WORKDIR /app/api
RUN npm install --production

# Copier le reste des fichiers de l'API
COPY api/ ./

# Créer les dossiers nécessaires
RUN mkdir -p /app/input /app/output /app/logs

# Retourner au répertoire principal
WORKDIR /app

# Exposer le port de l'API
EXPOSE 3000

# Variables d'environnement
ENV PORT=3000
ENV NODE_ENV=production

# Commande de démarrage
CMD ["node", "api/server.js"]
