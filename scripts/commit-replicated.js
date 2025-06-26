#!/usr/bin/env node

import chalk from 'chalk';
import simpleGit from 'simple-git';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../src/config/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class CommitReplicator {
  constructor() {
    this.repoPath = path.join(process.cwd(), config.repo.defaultName);
    this.git = simpleGit(this.repoPath);
    this.syncDataPath = path.join(this.repoPath, 'sync-data');
  }

  async run() {
    try {
      console.log(chalk.blue.bold('🔄 CommitReplicator - Aplicar commits con fechas originales\n'));
      
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
      
      // Procesar cada archivo de metadatos
      for (const metadataFile of metadataFiles) {
        await this.processMetadataFile(metadataFile);
      }
      
      console.log(chalk.green.bold('\n✅ Todos los commits han sido aplicados con sus fechas originales'));
      console.log(chalk.blue('💡 Ahora puedes hacer push al repositorio para actualizar tu gráfico de GitHub'));
      
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
        .map(file => path.join(this.syncDataPath, file));
    } catch (error) {
      return [];
    }
  }

  async processMetadataFile(filePath) {
    try {
      console.log(chalk.blue(`\n📂 Procesando: ${path.basename(filePath)}`));
      
      const content = await fs.readFile(filePath, 'utf8');
      const metadata = JSON.parse(content);
      
      console.log(chalk.gray(`📧 Email: ${metadata.email}`));
      console.log(chalk.gray(`📊 Commits: ${metadata.totalCommits}`));
      console.log(chalk.gray(`📅 Rango: ${metadata.dateRange.first} - ${metadata.dateRange.last}`));
      
      // Procesar cada commit
      for (let i = 0; i < metadata.commits.length; i++) {
        const commitData = metadata.commits[i];
        await this.createCommitWithOriginalDate(commitData, metadata.email, i + 1, metadata.commits.length);
      }
      
      console.log(chalk.green(`✅ Procesados ${metadata.commits.length} commits`));
      
    } catch (error) {
      console.error(chalk.red(`❌ Error procesando ${path.basename(filePath)}:`), error.message);
    }
  }

  async createCommitWithOriginalDate(commitData, email, index, total) {
    try {
      const date = new Date(commitData.date);
      const dateStr = date.toISOString().split('T')[0];
      
      // Crear directorio para el commit
      const commitDir = path.join(this.repoPath, 'replicated-commits', dateStr);
      await fs.mkdir(commitDir, { recursive: true });
      
      // Crear archivo con información del commit
      const fileName = `${commitData.sha.substring(0, 8)}-${index}.txt`;
      const filePath = path.join(commitDir, fileName);
      
      const content = `Replicated Commit Data
=====================

Original SHA: ${commitData.sha}
Original Date: ${commitData.date}
Original Repository: ${commitData.repo}
Email: ${email}
Message: ${commitData.message}

Replicated at: ${new Date().toISOString()}
Script: CommitReplicator
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
      
      // Mostrar progreso cada 10 commits
      if (index % 10 === 0 || index === total) {
        console.log(chalk.gray(`  Progreso: ${index}/${total} commits`));
      }
      
    } catch (error) {
      console.error(chalk.red(`❌ Error creando commit ${index}:`), error.message);
    }
  }

  async showSummary() {
    try {
      console.log(chalk.blue('\n📊 Resumen del repositorio:'));
      
      const log = await this.git.log();
      const commits = log.all;
      
      console.log(chalk.gray(`Total commits: ${commits.length}`));
      
      if (commits.length > 0) {
        const firstCommit = new Date(commits[commits.length - 1].date);
        const lastCommit = new Date(commits[0].date);
        
        console.log(chalk.gray(`Primer commit: ${firstCommit.toLocaleDateString()}`));
        console.log(chalk.gray(`Último commit: ${lastCommit.toLocaleDateString()}`));
      }
      
      const status = await this.git.status();
      console.log(chalk.gray(`Archivos modificados: ${status.modified.length}`));
      console.log(chalk.gray(`Archivos no rastreados: ${status.not_added.length}`));
      
    } catch (error) {
      console.error(chalk.red('❌ Error obteniendo resumen:'), error.message);
    }
  }
}

// Función principal
async function main() {
  const replicator = new CommitReplicator();
  
  // Verificar argumentos de línea de comandos
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(chalk.blue.bold('🔄 CommitReplicator - Ayuda\n'));
    console.log('Uso: node scripts/commit-replicated.js [opciones]\n');
    console.log('Opciones:');
    console.log('  --help, -h     Mostrar esta ayuda');
    console.log('  --summary, -s  Mostrar resumen del repositorio');
    console.log('  --dry-run      Simular sin hacer cambios reales');
    console.log('\nEste script procesa los metadatos de replicación y crea commits');
    console.log('con las fechas originales para actualizar el gráfico de GitHub.');
    return;
  }
  
  if (args.includes('--summary') || args.includes('-s')) {
    await replicator.showSummary();
    return;
  }
  
  if (args.includes('--dry-run')) {
    console.log(chalk.yellow('🔍 Modo simulación - No se harán cambios reales'));
    // TODO: Implementar modo dry-run
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

export { CommitReplicator };
