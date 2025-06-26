#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { CommitFaker } from './lib/CommitFaker.js';
import { GitHubSync } from './lib/GitHubSync.js';
import { PatternGenerator } from './lib/PatternGenerator.js';
import { EmailCommitSync } from './lib/EmailCommitSync.js';
import { config } from './config/config.js';

const program = new Command();

program
  .name('commit-faker')
  .description('Herramienta para actualizar el gráfico de contribuciones de GitHub')
  .version('1.0.0');

// Comando principal interactivo
program
  .command('start')
  .description('Iniciar el modo interactivo')
  .action(async () => {
    console.log(chalk.blue.bold('🎯 CommitFaker - Actualizador de Contribuciones GitHub\n'));
    
    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: '¿Qué quieres hacer?',
        choices: [
          { name: '📊 Crear commits falsos', value: 'fake' },
          { name: '🔄 Sincronizar commits de forks', value: 'sync' },
          { name: '📧 Sincronizar commits por email', value: 'email-sync' },
          { name: '📬 Sincronizar todos los emails', value: 'email-sync-all' },
          { name: '🔗 Sincronizar repositorio específico (URL)', value: 'sync-single-repo' },
          { name: '📦 Elegir email y repositorio destino', value: 'email-repo-select' },
          { name: '📋 Ver emails configurados', value: 'email-list' },
          { name: '🎨 Generar patrón de commits', value: 'pattern' },
          { name: '⚙️ Configurar repositorio', value: 'setup' },
          { name: '📈 Ver estadísticas', value: 'stats' }
        ]
      }
    ]);

    switch (answers.action) {
      case 'fake':
        await handleFakeCommits();
        break;
      case 'sync':
        await handleSyncForks();
        break;
      case 'email-sync':
        await handleEmailSync();
        break;
      case 'email-sync-all':
        await handleEmailSyncAll();
        break;
      case 'sync-single-repo':
        await handleSyncSingleRepo();
        break;
      case 'email-repo-select':
        await handleEmailRepoSelect();
        break;
      case 'email-list':
        await handleEmailList();
        break;
      case 'pattern':
        await handlePattern();
        break;
      case 'setup':
        await handleSetup();
        break;
      case 'stats':
        await handleStats();
        break;
    }
  });

// Comando para crear commits falsos
program
  .command('fake')
  .description('Crear commits falsos en un rango de fechas')
  .option('-s, --start <date>', 'Fecha de inicio (YYYY-MM-DD)')
  .option('-e, --end <date>', 'Fecha de fin (YYYY-MM-DD)')
  .option('-p, --pattern <type>', 'Tipo de patrón (random, wave, streak, custom)')
  .option('-i, --intensity <level>', 'Intensidad (low, medium, high)')
  .action(async (options) => {
    const commitFaker = new CommitFaker();
    await commitFaker.createFakeCommits(options);
  });

// Comando para sincronizar por email
program
  .command('email-sync')
  .description('Sincronizar commits realizados con un email específico')
  .option('-e, --email <email>', 'Email específico a buscar')
  .option('--all', 'Sincronizar todos los emails configurados')
  .option('--auto-confirm', 'Confirmar automáticamente la replicación')
  .action(async (options) => {
    const emailSync = new EmailCommitSync();
    await emailSync.syncEmailCommits(options);
  });

// Comando para sincronizar todos los emails
program
  .command('email-sync-all')
  .description('Sincronizar commits de todos los emails configurados')
  .option('--auto-confirm', 'Confirmar automáticamente la replicación')
  .action(async (options) => {
    const emailSync = new EmailCommitSync();
    await emailSync.syncAllEmails(options);
  });

// Comando para sincronizar repositorio específico
program
  .command('sync-single-repo')
  .description('Sincronizar commits de un repositorio específico')
  .option('-r, --repo <url>', 'URL del repositorio de GitHub')
  .option('-e, --email <email>', 'Email específico a buscar')
  .option('--auto-confirm', 'Confirmar automáticamente la replicación')
  .action(async (options) => {
    const emailSync = new EmailCommitSync();
    await emailSync.syncSingleRepository(options.repo, options);
  });

// Comando para elegir email y repositorio destino
program
  .command('email-repo-select')
  .description('Seleccionar email a replicar y repositorio destino')
  .option('-e, --email <email>', 'Email específico a buscar')
  .option('--auto-confirm', 'Confirmar automáticamente la replicación')
  .action(async (options) => {
    const emailSync = new EmailCommitSync();
    await emailSync.syncEmailFromSelectedRepo(options);
  });

// Comando para listar emails configurados
program
  .command('email-list')
  .description('Mostrar emails configurados para sincronización')
  .action(async () => {
    const emailSync = new EmailCommitSync();
    emailSync.showEmailSummary();
  });

// Comando para sincronizar forks
program
  .command('sync-forks')
  .description('Sincronizar commits de repositorios fork')
  .action(async () => {
    const githubSync = new GitHubSync();
    await githubSync.syncForkedRepos();
  });

// Comando para generar patrones
program
  .command('pattern')
  .description('Generar un patrón específico de commits')
  .option('-t, --type <pattern>', 'Tipo de patrón')
  .option('-i, --intensity <level>', 'Nivel de intensidad')
  .action(async (options) => {
    const patternGen = new PatternGenerator();
    await patternGen.generatePattern(options);
  });

// Comando de configuración
program
  .command('setup')
  .description('Configurar el repositorio para commits falsos')
  .action(async () => {
    const commitFaker = new CommitFaker();
    await commitFaker.setupRepository();
  });

// Funciones auxiliares
async function handleFakeCommits() {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'startDate',
      message: 'Fecha de inicio (YYYY-MM-DD):',
      default: '2024-01-01'
    },
    {
      type: 'input',
      name: 'endDate',
      message: 'Fecha de fin (YYYY-MM-DD):',
      default: '2024-12-31'
    },
    {
      type: 'list',
      name: 'pattern',
      message: 'Tipo de patrón:',
      choices: [
        { name: '🎲 Aleatorio', value: 'random' },
        { name: '🌊 Onda', value: 'wave' },
        { name: '🔥 Rachas', value: 'streak' },
        { name: '🎯 Personalizado', value: 'custom' }
      ]
    },
    {
      type: 'list',
      name: 'intensity',
      message: 'Intensidad:',
      choices: [
        { name: '🟢 Baja (1-3 commits/día)', value: 'low' },
        { name: '🟡 Media (3-7 commits/día)', value: 'medium' },
        { name: '🔴 Alta (7-15 commits/día)', value: 'high' }
      ]
    }
  ]);

  const commitFaker = new CommitFaker();
  await commitFaker.createFakeCommits(answers);
}

async function handleEmailSync() {
  const emailSync = new EmailCommitSync();
  const availableEmails = emailSync.getAvailableEmails();
  
  console.log(chalk.blue('📧 Sincronizando commits por email...'));
  
  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'emailChoice',
      message: '¿Qué email quieres sincronizar?',
      choices: [
        ...availableEmails.map(email => ({ name: `📧 ${email}`, value: email })),
        { name: '📬 Todos los emails configurados', value: 'all' },
        { name: '✏️  Especificar otro email', value: 'custom' }
      ]
    },
    {
      type: 'input',
      name: 'customEmail',
      message: 'Introduce el email personalizado:',
      when: (answers) => answers.emailChoice === 'custom',
      validate: (input) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(input) || 'Por favor introduce un email válido';
      }
    },
    {
      type: 'confirm',
      name: 'autoConfirm',
      message: '¿Replicar automáticamente los commits encontrados?',
      default: true
    }
  ]);

  const options = {
    autoConfirm: answers.autoConfirm
  };

  if (answers.emailChoice === 'all') {
    options.all = true;
  } else if (answers.emailChoice === 'custom') {
    options.email = answers.customEmail;
  } else {
    options.email = answers.emailChoice;
  }

  await emailSync.syncEmailCommits(options);
}

async function handleEmailRepoSelect() {
  const emailSync = new EmailCommitSync();
  
  console.log(chalk.blue('📦 Seleccionar email a replicar y repositorio destino...'));
  
  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'emailChoice',
      message: '¿De qué email quieres replicar commits?',
      choices: [
        ...emailSync.getAvailableEmails().map(email => ({ name: `📧 ${email}`, value: email })),
        { name: '✏️  Especificar otro email', value: 'custom' }
      ]
    },
    {
      type: 'input',
      name: 'customEmail',
      message: 'Introduce el email personalizado:',
      when: (answers) => answers.emailChoice === 'custom',
      validate: (input) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(input) || 'Por favor introduce un email válido';
      }
    }
  ]);

  const email = answers.emailChoice === 'custom' ? answers.customEmail : answers.emailChoice;
  
  console.log(chalk.yellow(`🎯 Buscando commits del email: ${email}`));
  console.log(chalk.gray('   → Después podrás elegir a cuál de tus repositorios replicar los commits\n'));
  
  await emailSync.syncEmailFromSelectedRepo({ email });
}

async function handleEmailSyncAll() {
  console.log(chalk.blue('📬 Sincronizando todos los emails configurados...'));
  
  const answers = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'autoConfirm',
      message: '¿Replicar automáticamente todos los commits encontrados?',
      default: true
    }
  ]);

  const emailSync = new EmailCommitSync();
  await emailSync.syncAllEmails(answers);
}

async function handleSyncSingleRepo() {
  const emailSync = new EmailCommitSync();
  
  console.log(chalk.blue('🔗 Sincronizando repositorio específico...'));
  
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'repoUrl',
      message: 'URL del repositorio de GitHub:',
      validate: (input) => {
        const githubUrlRegex = /^https:\/\/github\.com\/[^\/]+\/[^\/]+/;
        return githubUrlRegex.test(input) || 'Por favor introduce una URL válida de GitHub';
      }
    },
    {
      type: 'list',
      name: 'emailChoice',
      message: '¿Qué email quieres sincronizar?',
      choices: [
        ...emailSync.getAvailableEmails().map(email => ({ name: `📧 ${email}`, value: email })),
        { name: '✏️  Especificar otro email', value: 'custom' }
      ]
    },
    {
      type: 'input',
      name: 'customEmail',
      message: 'Introduce el email personalizado:',
      when: (answers) => answers.emailChoice === 'custom',
      validate: (input) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(input) || 'Por favor introduce un email válido';
      }
    },
    {
      type: 'confirm',
      name: 'autoConfirm',
      message: '¿Replicar automáticamente los commits encontrados?',
      default: true
    }
  ]);

  const options = {
    email: answers.emailChoice === 'custom' ? answers.customEmail : answers.emailChoice,
    autoConfirm: answers.autoConfirm
  };

  await emailSync.syncSingleRepository(answers.repoUrl, options);
}

async function handleEmailList() {
  console.log(chalk.blue('📋 Mostrando emails configurados...'));
  const emailSync = new EmailCommitSync();
  emailSync.showEmailSummary();
}

async function handleSyncForks() {
  console.log(chalk.yellow('🔄 Sincronizando commits de forks...'));
  const githubSync = new GitHubSync();
  await githubSync.syncForkedRepos();
}

async function handlePattern() {
  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'type',
      message: 'Selecciona un patrón:',
      choices: [
        { name: '📈 Crecimiento gradual', value: 'growth' },
        { name: '🌊 Onda sinusoidal', value: 'wave' },
        { name: '⚡ Picos aleatorios', value: 'spikes' },
        { name: '🔄 Patrón cíclico', value: 'cycle' }
      ]
    }
  ]);

  const patternGen = new PatternGenerator();
  await patternGen.generatePattern(answers);
}

async function handleSetup() {
  console.log(chalk.green('⚙️ Configurando repositorio...'));
  const commitFaker = new CommitFaker();
  await commitFaker.setupRepository();
}

async function handleStats() {
  console.log(chalk.blue('📈 Mostrando estadísticas...'));
  const githubSync = new GitHubSync();
  await githubSync.showStats();
}

// Establecer el comando por defecto
if (process.argv.length === 2) {
  program.parse(['node', 'cli.js', 'start']);
} else {
  program.parse();
}
