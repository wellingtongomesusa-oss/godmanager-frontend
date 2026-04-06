let currentUsername = '';

// Elementos do DOM
const loginScreen = document.getElementById('loginScreen');
const messageScreen = document.getElementById('messageScreen');
const loginForm = document.getElementById('loginForm');
const messageForm = document.getElementById('messageForm');
const logoutBtn = document.getElementById('logoutBtn');
const loginError = document.getElementById('loginError');
const messageError = document.getElementById('messageError');
const messageSuccess = document.getElementById('messageSuccess');
const currentUsernameDisplay = document.getElementById('currentUsername');
const messagesList = document.getElementById('messagesList');

// Event Listeners
loginForm.addEventListener('submit', handleLogin);
messageForm.addEventListener('submit', handleCreateMessage);
logoutBtn.addEventListener('click', handleLogout);

// Função de Login
async function handleLogin(e) {
    e.preventDefault();
    hideError(loginError);
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            currentUsername = username;
            currentUsernameDisplay.textContent = username;
            showScreen('message');
            loadMessages();
        } else {
            showError(loginError, data.message);
        }
    } catch (error) {
        showError(loginError, 'Erro ao fazer login. Tente novamente.');
        console.error('Erro:', error);
    }
}

// Função para criar mensagem
async function handleCreateMessage(e) {
    e.preventDefault();
    hideError(messageError);
    hideSuccess(messageSuccess);
    
    const message = document.getElementById('message').value;
    
    if (!message.trim()) {
        showError(messageError, 'Por favor, digite uma mensagem.');
        return;
    }
    
    try {
        const response = await fetch('/api/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username: currentUsername, message })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showSuccess(messageSuccess, 'Mensagem criada com sucesso!');
            document.getElementById('message').value = '';
            loadMessages();
        } else {
            showError(messageError, data.message || 'Erro ao criar mensagem.');
        }
    } catch (error) {
        showError(messageError, 'Erro ao criar mensagem. Tente novamente.');
        console.error('Erro:', error);
    }
}

// Função para carregar mensagens
async function loadMessages() {
    try {
        const response = await fetch('/api/messages');
        const messages = await response.json();
        
        messagesList.innerHTML = '';
        
        if (messages.length === 0) {
            messagesList.innerHTML = '<p style="text-align: center; color: #888;">Nenhuma mensagem ainda.</p>';
            return;
        }
        
        messages.forEach(msg => {
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message-item';
            
            const date = new Date(msg.timestamp);
            const formattedDate = date.toLocaleString('pt-BR');
            
            messageDiv.innerHTML = `
                <div class="message-header">
                    <span class="message-username">${escapeHtml(msg.username)}</span>
                    <span class="message-time">${formattedDate}</span>
                </div>
                <div class="message-content">${escapeHtml(msg.message)}</div>
            `;
            
            messagesList.appendChild(messageDiv);
        });
    } catch (error) {
        console.error('Erro ao carregar mensagens:', error);
    }
}

// Função de Logout
function handleLogout() {
    currentUsername = '';
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    showScreen('login');
}

// Funções auxiliares
function showScreen(screen) {
    if (screen === 'login') {
        loginScreen.classList.add('active');
        messageScreen.classList.remove('active');
    } else {
        loginScreen.classList.remove('active');
        messageScreen.classList.add('active');
    }
}

function showError(element, message) {
    element.textContent = message;
    element.classList.add('show');
}

function hideError(element) {
    element.classList.remove('show');
}

function showSuccess(element, message) {
    element.textContent = message;
    element.classList.add('show');
    setTimeout(() => {
        hideSuccess(element);
    }, 3000);
}

function hideSuccess(element) {
    element.classList.remove('show');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
