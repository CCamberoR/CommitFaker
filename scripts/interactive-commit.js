#!/usr/bin/env node

import chalk from 'chalk';
import inquirer from 'inquirer';
import simpleGit from 'simple-git';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../src/config/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class InteractiveCommitReplicator {
  constructor() {
    this.repoPath = path.join(process.cwd(), config.repo.defaultName);
    this.git = simpleGit(this.repoPath);
    this.syncDataPath = path.join(this.repoPath, 'sync-data');
  }

  async run() {
    try {
      console.log(chalk.blue.bold('🎯 CommitReplicator Interactivo - Aplicar commits individuales\n'));
      
      // Verificar que el repositorio existe
      if (!(await this.checkRepository())) {
        console.log(chalk.red('❌ El repositorio de commits no existe. Ejecuta primero la sincronización.'));
        return;
      }
      
      // Buscar archivos de metadatos
      const metadataFiles = await this.findMetadataFiles();
      
      if (metadataFiles.length === 0) {
        console.log(chalk.yellow('⚠️ No se encontraron metadatos de replicación. Ejecuta primero la sincronización.'));
        return;
      }
      
      console.log(chalk.green(`✅ Encontrados ${metadataFiles.length} archivos de metadatos`));
      
      // Mostrar archivos disponibles
      const choices = metadataFiles.map(file => {
        const basename = path.basename(file);
        const match = basename.match(/replication_(.+?)_(\d{4}-\d{2}-\d{2})/);
        const email = match ? match[1] : 'unknown';
        const date = match ? match[2] : 'unknown';
        return {
          name: `📧 ${email} - ${date}`,
          value: file
        };
      });
      
      choices.push(
        new inquirer.Separator(),
        { name: '🔄 Procesar todos los archivos automáticamente', value: 'all' },
        { name: '❌ Cancelar', value: 'cancel' }
      );
      
      const { selectedFile } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedFile',
          message: '¿Qué archivo de metadatos quieres procesar?',
          choices: choices,
          pageSize: 10
        }
      ]);
      
      if (selectedFile === 'cancel') {
        console.log(chalk.yellow('👋 Operación cancelada'));
        return;
      }
      
      if (selectedFile === 'all') {
        const { confirmAll } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirmAll',
            message: '¿Procesar todos los archivos automáticamente?',
            default: false
          }
        ]);
        
        if (confirmAll) {
          for (const file of metadataFiles) {
            await this.processMetadataFile(file, false);
          }
        }
        return;
      }
      
      // Procesar archivo seleccionado
      await this.processMetadataFile(selectedFile, true);
      
    } catch (error) {
      console.error(chalk.red('❌ Error:'), error.message);
      process.exit(1);
    }
  }

  async checkRepository() {
    try {
      await fs.access(this.repoPath);
      await this.git.status();
      return true;
    } catch (error) {
      return false;
    }
  }

  async findMetadataFiles() {
    try {
      await fs.access(this.syncDataPath);
      const files = await fs.readdir(this.syncDataPath);
      
      return files
        .filter(file => file.startsWith('replication_') && file.endsWith('.json'))
        .map(file => path.join(this.syncDataPath, file))
        .sort();
    } catch (error) {
      return [];
    }
  }

  async processMetadataFile(filePath, interactive = true) {
    try {
      console.log(chalk.blue(`\n📂 Procesando: ${path.basename(filePath)}`));
      
      const content = await fs.readFile(filePath, 'utf8');
      const metadata = JSON.parse(content);
      
      console.log(chalk.gray(`📧 Email: ${metadata.email}`));
      console.log(chalk.gray(`📊 Commits: ${metadata.totalCommits}`));
      console.log(chalk.gray(`📅 Rango: ${metadata.dateRange.first} - ${metadata.dateRange.last}`));
      
      if (interactive) {
        const { mode } = await inquirer.prompt([
          {
            type: 'list',
            name: 'mode',
            message: '¿Cómo quieres procesar los commits?',
            choices: [
              { name: '🚀 Automático - Crear todos los commits', value: 'auto' },
              { name: '🎯 Individual - Seleccionar commits específicos', value: 'individual' },
              { name: '⏱️  Por fechas - Seleccionar rango de fechas', value: 'date-range' },
              { name: '❌ Cancelar', value: 'cancel' }
            ]
          }
        ]);
        
        if (mode === 'cancel') {
          console.log(chalk.yellow('👋 Procesamiento cancelado'));
          return;
        }
        
        switch (mode) {
          case 'auto':
            await this.processAllCommits(metadata);
            break;
          case 'individual':
            await this.processIndividualCommits(metadata);
            break;
          case 'date-range':
            await this.processDateRangeCommits(metadata);
            break;
        }
      } else {
        await this.processAllCommits(metadata);
      }
      
    } catch (error) {
      console.error(chalk.red(`❌ Error procesando ${path.basename(filePath)}:`), error.message);
    }
  }

  async processAllCommits(metadata) {
    console.log(chalk.blue(`🚀 Procesando ${metadata.commits.length} commits automáticamente...`));
    
    for (let i = 0; i < metadata.commits.length; i++) {
      const commitData = metadata.commits[i];
      await this.createCommitWithOriginalDate(commitData, metadata.email, i + 1, metadata.commits.length);
    }
    
    console.log(chalk.green(`✅ Procesados ${metadata.commits.length} commits`));
  }

  async processIndividualCommits(metadata) {
    console.log(chalk.blue('🎯 Modo individual - Selecciona commits específicos\n'));
    
    const commitChoices = metadata.commits.map((commit, index) => {
      const date = new Date(commit.date).toLocaleDateString();
      const shortSha = commit.sha.substring(0, 8);
      const shortMessage = commit.message.substring(0, 50) + (commit.message.length > 50 ? '...' : '');
      
      return {
        name: `${date} - ${shortSha} - ${shortMessage}`,
        value: index,
        checked: false
      };
    });

    const { selectedCommits } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'selectedCommits',
        message: 'Selecciona los commits que quieres procesar:',
        choices: commitChoices,
        pageSize: 15
      }
    ]);

    if (selectedCommits.length === 0) {
      console.log(chalk.yellow('⚠️ No se seleccionaron commits'));
      return;
    }

    console.log(chalk.blue(`🎯 Procesando ${selectedCommits.length} commits seleccionados...`));
    
    for (let i = 0; i < selectedCommits.length; i++) {
      const commitIndex = selectedCommits[i];
      const commitData = metadata.commits[commitIndex];
      await this.createCommitWithOriginalDate(commitData, metadata.email, i + 1, selectedCommits.length);
    }
    
    console.log(chalk.green(`✅ Procesados ${selectedCommits.length} commits seleccionados`));
  }

  async processDateRangeCommits(metadata) {
    console.log(chalk.blue('⏱️ Modo por rango de fechas\n'));
    
    const dates = metadata.commits.map(c => new Date(c.date)).sort((a, b) => a - b);
    const minDate = dates[0].toISOString().split('T')[0];
    const maxDate = dates[dates.length - 1].toISOString().split('T')[0];
    
    console.log(chalk.gray(`Rango disponible: ${minDate} a ${maxDate}`));
    
    const { startDate, endDate } = await inquirer.prompt([
      {
        type: 'input',
        name: 'startDate',
        message: 'Fecha de inicio (YYYY-MM-DD):',
        default: minDate,
        validate: (input) => {
          const date = new Date(input);
          return !isNaN(date.getTime()) || 'Fecha inválida';
        }
      },
      {
        type: 'input',
        name: 'endDate',
        message: 'Fecha de fin (YYYY-MM-DD):',
        default: maxDate,
        validate: (input) => {
          const date = new Date(input);
          return !isNaN(date.getTime()) || 'Fecha inválida';
        }
      }
    ]);

    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const filteredCommits = metadata.commits.filter(commit => {
      const commitDate = new Date(commit.date);
      return commitDate >= start && commitDate <= end;
    });

    if (filteredCommits.length === 0) {
      console.log(chalk.yellow('⚠️ No se encontraron commits en el rango especificado'));
      return;
    }

    console.log(chalk.blue(`📅 Procesando ${filteredCommits.length} commits en el rango ${startDate} a ${endDate}...`));
    
    for (let i = 0; i < filteredCommits.length; i++) {
      const commitData = filteredCommits[i];
      await this.createCommitWithOriginalDate(commitData, metadata.email, i + 1, filteredCommits.length);
    }
    
    console.log(chalk.green(`✅ Procesados ${filteredCommits.length} commits en el rango especificado`));
  }

  async createCommitWithOriginalDate(commitData, email, index, total) {
    try {
      const date = new Date(commitData.date);
      const dateStr = date.toISOString().split('T')[0];
      
      // Crear directorio para el commit
      const commitDir = path.join(this.repoPath, 'replicated-commits', dateStr);
      await fs.mkdir(commitDir, { recursive: true });
      
      // Crear archivo con información del commit
      const fileName = `${commitData.sha.substring(0, 8)}-${Date.now()}.txt`;
      const filePath = path.join(commitDir, fileName);
      
      const content = `Replicated Commit Data
=====================

Original SHA: ${commitData.sha}
Original Date: ${commitData.date}
Original Repository: ${commitData.repo}
Email: ${email}
Message: ${commitData.message}

Replicated at: ${new Date().toISOString()}
Script: InteractiveCommitReplicator
Index: ${index}/${total}

This commit was replicated to include it in the GitHub contribution graph.
`;
      
      await fs.writeFile(filePath, content);
      
      // Agregar archivo al git
      await this.git.add(filePath);
      
      // Crear commit con fecha original
      const commitMessage = `[REPLICATED] ${commitData.message.substring(0, 50)}${commitData.message.length > 50 ? '...' : ''}`;
      
      await this.git.env({
        GIT_AUTHOR_DATE: commitData.date,
        GIT_COMMITTER_DATE: commitData.date,
        GIT_AUTHOR_EMAIL: email,
        GIT_COMMITTER_EMAIL: email
      }).commit(commitMessage);
      
      console.log(chalk.green(`  ✅ Commit ${index}/${total} - ${dateStr} - ${commitData.sha.substring(0, 8)}`));
      
    } catch (error) {
      console.error(chalk.red(`❌ Error creando commit ${index}:`), error.message);
    }
  }
}

// Función principal
async function main() {
  const replicator = new InteractiveCommitReplicator();
  
  // Verificar argumentos de línea de comandos
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(chalk.blue.bold('🎯 CommitReplicator Interactivo - Ayuda\n'));
    console.log('Uso: node scripts/interactive-commit.js [opciones]\n');
    console.log('Opciones:');
    console.log('  --help, -h     Mostrar esta ayuda');
    console.log('\nEste script permite procesar commits de forma interactiva,');
    console.log('seleccionando commits específicos, rangos de fechas o procesamientos automáticos.');
    return;
  }
  
  await replicator.run();
}

// Manejar errores no capturados
process.on('unhandledRejection', (error) => {
  console.error(chalk.red('❌ Error no manejado:'), error);
  process.exit(1);
});

// Ejecutar script si es llamado directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { InteractiveCommitReplicator };
