# Aplicação Simples de Login e Mensagens

Uma aplicação web simples que permite fazer login e criar mensagens, containerizada com Docker.

## Funcionalidades

- ✅ Login de usuário
- ✅ Criação de mensagens
- ✅ Visualização de mensagens existentes
- ✅ Interface moderna e responsiva

## Usuários de Teste

- **Usuário:** `admin` | **Senha:** `admin123`
- **Usuário:** `user` | **Senha:** `user123`

## Como Executar com Docker

### 1. Construir a imagem Docker

```bash
docker build -t simple-message-app .
```

### 2. Executar o container

```bash
docker run -d -p 3000:3000 --name message-app simple-message-app
```

### 3. Acessar a aplicação

Abra seu navegador e acesse: `http://localhost:3000`

## Como Parar o Container

```bash
docker stop message-app
docker rm message-app
```

## Estrutura do Projeto

```
.
├── server.js          # Servidor Express
├── package.json       # Dependências Node.js
├── Dockerfile         # Configuração Docker
├── .dockerignore      # Arquivos ignorados no build
└── public/            # Arquivos estáticos
    ├── index.html     # Interface HTML
    ├── style.css      # Estilos CSS
    └── script.js      # Lógica JavaScript
```

## Tecnologias Utilizadas

- **Node.js** - Runtime JavaScript
- **Express** - Framework web
- **Docker** - Containerização
- **HTML/CSS/JavaScript** - Frontend
