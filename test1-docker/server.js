const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Armazenamento simples em memória (para demonstração)
let messages = [];
let users = [
  { username: 'admin', password: 'admin123' },
  { username: 'user', password: 'user123' }
];

// Rota principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Rota de login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  const user = users.find(u => u.username === username && u.password === password);
  
  if (user) {
    res.json({ success: true, message: 'Login realizado com sucesso!' });
  } else {
    res.status(401).json({ success: false, message: 'Usuário ou senha inválidos' });
  }
});

// Rota para obter mensagens
app.get('/api/messages', (req, res) => {
  res.json(messages);
});

// Rota para criar mensagem
app.post('/api/messages', (req, res) => {
  const { username, message } = req.body;
  
  if (!username || !message) {
    return res.status(400).json({ success: false, message: 'Usuário e mensagem são obrigatórios' });
  }
  
  const newMessage = {
    id: messages.length + 1,
    username,
    message,
    timestamp: new Date().toISOString()
  };
  
  messages.push(newMessage);
  res.json({ success: true, message: 'Mensagem criada com sucesso!', data: newMessage });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
