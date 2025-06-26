// Socket.IO connection
const socket = io();

// DOM elements
const statusIndicator = document.getElementById('status-indicator');
const statusText = document.getElementById('status-text');
const configWarning = document.getElementById('config-warning');
const configErrors = document.getElementById('config-errors');
const logsContainer = document.getElementById('logs');

// Initialize application
document.addEventListener('DOMContentLoaded', async () => {
    await checkStatus();
    await loadEmails();
    setupTabs();
    setupForms();
    setupSocketListeners();
    setupPatternCards();
});

// Check application status
async function checkStatus() {
    try {
        const response = await fetch('/api/status');
        const data = await response.json();
        
        if (data.status === 'ready') {
            statusIndicator.className = 'status-indicator ready';
            statusText.textContent = 'Configuración válida - Listo para usar';
            configWarning.style.display = 'none';
        } else {
            statusIndicator.className = 'status-indicator warning';
            statusText.textContent = 'Configuración incompleta';
            showConfigWarning(data.errors);
        }
    } catch (error) {
        statusIndicator.className = 'status-indicator error';
        statusText.textContent = 'Error de conexión';
        addLog('error', 'Error conectando con el servidor: ' + error.message);
    }
}

// Show configuration warning
function showConfigWarning(errors) {
    configWarning.style.display = 'flex';
    configErrors.innerHTML = '';
    errors.forEach(error => {
        const li = document.createElement('li');
        li.textContent = error;
        configErrors.appendChild(li);
    });
}

// Load available emails
async function loadEmails() {
    try {
        const response = await fetch('/api/emails');
        const data = await response.json();
        
        // Populate email selects
        const syncEmailSelect = document.getElementById('sync-email');
        const repoEmailSelect = document.getElementById('repo-email');
        
        // Clear existing options
        syncEmailSelect.innerHTML = '';
        repoEmailSelect.innerHTML = '';
        
        // Add email options
        data.emails.forEach(email => {
            const option1 = new Option(email, email);
            const option2 = new Option(email, email);
            
            if (email === data.defaultEmail) {
                option1.selected = true;
                option2.selected = true;
            }
            
            syncEmailSelect.appendChild(option1);
            repoEmailSelect.appendChild(option2);
        });
        
        // Add custom email option
        syncEmailSelect.appendChild(new Option('✏️ Otro email...', 'custom'));
        repoEmailSelect.appendChild(new Option('✏️ Otro email...', 'custom'));
        
    } catch (error) {
        addLog('error', 'Error cargando emails: ' + error.message);
    }
}

// Setup tabs
function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabPanels = document.querySelectorAll('.tab-panel');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.dataset.tab;
            
            // Remove active class from all buttons and panels
            tabButtons.forEach(b => b.classList.remove('active'));
            tabPanels.forEach(p => p.classList.remove('active'));
            
            // Add active class to clicked button and corresponding panel
            button.classList.add('active');
            document.getElementById(targetTab).classList.add('active');
        });
    });
}

// Setup forms
function setupForms() {
    // Fake commits form
    document.getElementById('fake-commits-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = {
            startDate: document.getElementById('start-date').value,
            endDate: document.getElementById('end-date').value,
            pattern: document.getElementById('pattern').value,
            intensity: document.getElementById('intensity').value
        };
        
        await submitForm('/api/fake-commits', formData, 'Creando commits falsos...');
    });
    
    // Email sync form
    document.getElementById('email-sync-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        let email = document.getElementById('sync-email').value;
        
        if (email === 'custom') {
            email = prompt('Introduce el email personalizado:');
            if (!email || !isValidEmail(email)) {
                addLog('error', 'Email inválido');
                return;
            }
        }
        
        const formData = {
            email: email,
            autoConfirm: document.getElementById('auto-confirm').checked
        };
        
        await submitForm('/api/email-sync', formData, `Sincronizando email: ${email}...`);
    });
    
    // Sync all emails button
    document.getElementById('sync-all-emails').addEventListener('click', async () => {
        const formData = {
            autoConfirm: true
        };
        
        await submitForm('/api/email-sync-all', formData, 'Sincronizando todos los emails...');
    });
    
    // Single repo form
    document.getElementById('single-repo-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        let email = document.getElementById('repo-email').value;
        
        if (email === 'custom') {
            email = prompt('Introduce el email personalizado:');
            if (!email || !isValidEmail(email)) {
                addLog('error', 'Email inválido');
                return;
            }
        }
        
        const formData = {
            repoUrl: document.getElementById('repo-url').value,
            email: email,
            autoConfirm: document.getElementById('repo-auto-confirm').checked
        };
        
        await submitForm('/api/sync-single-repo', formData, `Sincronizando repositorio: ${formData.repoUrl}...`);
    });
    
    // Stats actions
    document.getElementById('load-stats').addEventListener('click', async () => {
        await submitForm('/api/stats', {}, 'Cargando estadísticas...');
    });
    
    document.getElementById('sync-forks').addEventListener('click', async () => {
        await submitForm('/api/sync-forks', {}, 'Sincronizando forks...');
    });
    
    // Clear logs button
    document.getElementById('clear-logs').addEventListener('click', () => {
        logsContainer.innerHTML = '';
    });
}

// Setup pattern cards
function setupPatternCards() {
    document.querySelectorAll('.pattern-card').forEach(card => {
        const button = card.querySelector('.btn');
        const pattern = card.dataset.pattern;
        
        button.addEventListener('click', async () => {
            const intensity = prompt('Intensidad (low/medium/high):', 'medium');
            if (!intensity) return;
            
            await submitForm('/api/generate-pattern', { type: pattern, intensity }, `Generando patrón: ${pattern}...`);
        });
    });
}

// Setup socket listeners
function setupSocketListeners() {
    socket.on('log', (data) => {
        addLog(data.level, data.message, data.data, data.timestamp);
    });
    
    socket.on('connect', () => {
        addLog('info', 'Conectado al servidor');
    });
    
    socket.on('disconnect', () => {
        addLog('warning', 'Desconectado del servidor');
    });
}

// Submit form helper
async function submitForm(url, data, message) {
    try {
        addLog('info', message);
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            addLog('success', result.message || 'Operación iniciada');
        } else {
            addLog('error', result.error || 'Error en la operación');
        }
    } catch (error) {
        addLog('error', 'Error de conexión: ' + error.message);
    }
}

// Add log entry
function addLog(level, message, data = null, timestamp = null) {
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${level}`;
    
    const timeStr = timestamp ? new Date(timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();
    
    logEntry.innerHTML = `
        <span class="log-timestamp">[${timeStr}]</span>
        <span class="log-message">${message}</span>
    `;
    
    logsContainer.appendChild(logEntry);
    logsContainer.scrollTop = logsContainer.scrollHeight;
    
    // Keep only last 100 log entries
    const logs = logsContainer.querySelectorAll('.log-entry');
    if (logs.length > 100) {
        logs[0].remove();
    }
}

// Email validation helper
function isValidEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
}

// Set today's date as default for date inputs
document.addEventListener('DOMContentLoaded', () => {
    const today = new Date().toISOString().split('T')[0];
    const endDateInput = document.getElementById('end-date');
    if (endDateInput && !endDateInput.value) {
        endDateInput.value = today;
    }
});
