#!/bin/bash

# Script para iniciar a aplicação Docker

# Carregar configurações do zsh (incluindo PATH do Docker)
source ~/.zshrc 2>/dev/null || true

# Verificar se o Docker está acessível
if ! docker ps &>/dev/null; then
    echo "❌ Erro: Docker não está acessível."
    echo "Por favor, certifique-se de que o Docker Desktop está rodando."
    exit 1
fi

echo "Construindo a imagem Docker..."
docker build -t simple-message-app .

if [ $? -eq 0 ]; then
    echo "Imagem construída com sucesso!"
    echo ""
    echo "Parando container existente (se houver)..."
    docker stop message-app 2>/dev/null
    docker rm message-app 2>/dev/null
    
    echo "Iniciando o container..."
    docker run -d -p 3000:3000 --name message-app simple-message-app
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ Aplicação iniciada com sucesso!"
        echo "🌐 Acesse: http://localhost:3000"
        echo ""
        echo "Para parar a aplicação, execute:"
        echo "  docker stop message-app"
        echo "  docker rm message-app"
    else
        echo "❌ Erro ao iniciar o container"
    fi
else
    echo "❌ Erro ao construir a imagem"
fi
