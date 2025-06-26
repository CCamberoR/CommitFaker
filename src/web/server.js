import express from 'express';
import { Server } from 'socket.io';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import chalk from 'chalk';
import { config, validateConfig } from '../config/config.js';
import { CommitFaker } from '../lib/CommitFaker.js';
import { EmailCommitSync } from '../lib/EmailCommitSync.js';
import { GitHubSync } from '../lib/GitHubSync.js';
import { PatternGenerator } from '../lib/PatternGenerator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Instancias de las clases principales
const commitFaker = new CommitFaker();
const emailSync = new EmailCommitSync();
const githubSync = new GitHubSync();
const patternGenerator = new PatternGenerator();

// Función para emitir logs a los clientes conectados
function emitLog(level, message, data = null) {
  io.emit('log', { level, message, data, timestamp: new Date().toISOString() });
  
  // También mostrar en consola del servidor
  const colors = {
    info: chalk.blue,
    success: chalk.green,
    warning: chalk.yellow,
    error: chalk.red
  };
  
  const colorFn = colors[level] || chalk.white;
  console.log(colorFn(`[${level.toUpperCase()}] ${message}`));
}

// Rutas de la API
app.get('/api/status', (req, res) => {
  const configErrors = validateConfig();
  
  res.json({
    status: configErrors.length === 0 ? 'ready' : 'configuration_needed',
    errors: configErrors,
    config: {
      username: config.github.username,
      emails: config.sync.emails,
      defaultEmail: config.sync.defaultEmail,
      repoName: config.repo.defaultName
    }
  });
});

app.get('/api/emails', (req, res) => {
  res.json({
    emails: config.sync.emails,
    defaultEmail: config.sync.defaultEmail
  });
});

app.post('/api/fake-commits', async (req, res) => {
  try {
    const { startDate, endDate, pattern, intensity } = req.body;
    
    emitLog('info', `Iniciando creación de commits falsos: ${startDate} - ${endDate}`);
    
    // Ejecutar en segundo plano
    commitFaker.createFakeCommits({
      startDate,
      endDate,
      pattern,
      intensity
    }).then(() => {
      emitLog('success', 'Commits falsos creados exitosamente');
    }).catch(error => {
      emitLog('error', `Error creando commits falsos: ${error.message}`);
    });
    
    res.json({ status: 'started', message: 'Creación de commits iniciada' });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/email-sync', async (req, res) => {
  try {
    const { email, autoConfirm } = req.body;
    
    emitLog('info', `Iniciando sincronización por email: ${email}`);
    
    // Ejecutar en segundo plano
    emailSync.syncEmailCommits({
      email,
      autoConfirm: autoConfirm !== false
    }).then(() => {
      emitLog('success', 'Sincronización por email completada');
    }).catch(error => {
      emitLog('error', `Error en sincronización por email: ${error.message}`);
    });
    
    res.json({ status: 'started', message: 'Sincronización iniciada' });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/email-sync-all', async (req, res) => {
  try {
    const { autoConfirm } = req.body;
    
    emitLog('info', 'Iniciando sincronización de todos los emails');
    
    // Ejecutar en segundo plano
    emailSync.syncAllEmails({
      autoConfirm: autoConfirm !== false
    }).then(() => {
      emitLog('success', 'Sincronización de todos los emails completada');
    }).catch(error => {
      emitLog('error', `Error en sincronización masiva: ${error.message}`);
    });
    
    res.json({ status: 'started', message: 'Sincronización masiva iniciada' });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/sync-single-repo', async (req, res) => {
  try {
    const { repoUrl, email, autoConfirm } = req.body;
    
    emitLog('info', `Iniciando sincronización de repositorio: ${repoUrl}`);
    
    // Ejecutar en segundo plano
    emailSync.syncSingleRepository(repoUrl, {
      email: email || config.sync.defaultEmail,
      autoConfirm: autoConfirm !== false
    }).then(() => {
      emitLog('success', 'Sincronización de repositorio completada');
    }).catch(error => {
      emitLog('error', `Error sincronizando repositorio: ${error.message}`);
    });
    
    res.json({ status: 'started', message: 'Sincronización de repositorio iniciada' });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/sync-forks', async (req, res) => {
  try {
    emitLog('info', 'Iniciando sincronización de forks');
    
    // Ejecutar en segundo plano
    githubSync.syncForkedRepos().then(() => {
      emitLog('success', 'Sincronización de forks completada');
    }).catch(error => {
      emitLog('error', `Error sincronizando forks: ${error.message}`);
    });
    
    res.json({ status: 'started', message: 'Sincronización de forks iniciada' });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/generate-pattern', async (req, res) => {
  try {
    const { type, intensity } = req.body;
    
    emitLog('info', `Generando patrón: ${type} (${intensity})`);
    
    const pattern = await patternGenerator.generatePattern({ type, intensity });
    
    emitLog('success', `Patrón ${type} generado con ${pattern.length} puntos`);
    
    res.json({ status: 'success', pattern });
    
  } catch (error) {
    emitLog('error', `Error generando patrón: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/stats', async (req, res) => {
  try {
    emitLog('info', 'Obteniendo estadísticas de GitHub');
    
    await githubSync.showStats();
    
    res.json({ status: 'success', message: 'Estadísticas mostradas en logs' });
    
  } catch (error) {
    emitLog('error', `Error obteniendo estadísticas: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Socket.IO para comunicación en tiempo real
io.on('connection', (socket) => {
  console.log(chalk.green('👤 Cliente conectado'));
  
  socket.emit('log', {
    level: 'info',
    message: 'Conectado al servidor CommitFaker',
    timestamp: new Date().toISOString()
  });
  
  socket.on('disconnect', () => {
    console.log(chalk.gray('👤 Cliente desconectado'));
  });
});

// Ruta principal - servir la aplicación web
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Iniciar servidor
const PORT = config.web.port;
const HOST = config.web.host;

server.listen(PORT, HOST, () => {
  console.log(chalk.blue.bold('🌐 CommitFaker Web Interface'));
  console.log(chalk.green(`✅ Servidor ejecutándose en http://${HOST}:${PORT}`));
  console.log(chalk.gray(`📁 Archivos estáticos en: ${path.join(__dirname, 'public')}`));
  
  // Validar configuración al iniciar
  const configErrors = validateConfig();
  if (configErrors.length > 0) {
    console.log(chalk.yellow('⚠️ Configuración incompleta:'));
    configErrors.forEach(error => console.log(chalk.red(`  ❌ ${error}`)));
    console.log(chalk.blue('💡 Edita el archivo .env para completar la configuración'));
  } else {
    console.log(chalk.green('✅ Configuración válida'));
  }
});

export default app;
