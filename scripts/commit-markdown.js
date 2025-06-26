#!/usr/bin/env node

import chalk from 'chalk';
import simpleGit from 'simple-git';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../src/config/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class MarkdownCommitter {
  constructor() {
    // Si ya estamos en commit-history, usar el directorio actual
    // Si no, usar la configuración por defecto
    const currentDir = path.basename(process.cwd());
    if (currentDir === config.repo.defaultName) {
      this.repoPath = process.cwd();
    } else {
      this.repoPath = path.join(process.cwd(), config.repo.defaultName);
    }
    this.git = simpleGit(this.repoPath);
    this.syncDataPath = path.join(this.repoPath, 'sync-data');
  }

  async run() {
    try {
      console.log(chalk.blue.bold('🔄 MarkdownCommitter - Crear commits individuales con archivos markdown\n'));
      
      // Buscar archivos de metadatos
      const metadataFiles = await this.findMetadataFiles();
      if (metadataFiles.length === 0) {
        console.log(chalk.red('❌ No se encontraron archivos de metadatos.'));
        return;
      }

      console.log(chalk.green(`✅ Encontrados ${metadataFiles.length} archivos de metadatos`));

      // Procesar cada archivo de metadatos
      for (const filePath of metadataFiles) {
        await this.processMetadataFile(filePath);
      }

      console.log(chalk.green.bold('\n✅ Todos los commits han sido procesados'));
      console.log(chalk.blue('💡 Ahora puedes hacer push al repositorio para actualizar tu gráfico de GitHub'));
      
    } catch (error) {
      console.error(chalk.red('❌ Error no manejado:'), error);
    }
  }

  async findMetadataFiles() {
    try {
      const files = await fs.readdir(this.syncDataPath);
      return files
        .filter(file => file.startsWith('replication_') && file.endsWith('.json'))
        .map(file => path.join(this.syncDataPath, file));
    } catch (error) {
      console.error(chalk.red('Error buscando archivos de metadatos:'), error.message);
      return [];
    }
  }

  async processMetadataFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const metadata = JSON.parse(content);
      
      console.log(chalk.blue(`\n📂 Procesando: ${path.basename(filePath)}`));
      console.log(chalk.gray(`📧 Email: ${metadata.email}`));
      console.log(chalk.gray(`📊 Commits: ${metadata.commits.length}`));
      
      // Convertir email a formato de carpeta
      const emailFolder = this.emailToFolderName(metadata.email);
      
      // Procesar cada commit
      for (let i = 0; i < metadata.commits.length; i++) {
        const commit = metadata.commits[i];
        await this.createMarkdownCommit(commit, emailFolder, i + 1, metadata.commits.length, metadata.email);
      }
      
      console.log(chalk.green(`✅ Procesados ${metadata.commits.length} commits`));
      
    } catch (error) {
      console.error(chalk.red(`❌ Error procesando ${path.basename(filePath)}:`), error.message);
    }
  }

  emailToFolderName(email) {
    return email.replace(/@/g, '_at_').replace(/\./g, '_dot_').replace(/\+/g, '_plus_');
  }

  async createMarkdownCommit(commitData, emailFolder, commitIndex, totalCommits, originalEmail) {
    try {
      const date = new Date(commitData.date);
      const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
      
      // Crear estructura de directorios
      const commitsDir = path.join(this.repoPath, 'commits');
      const emailDir = path.join(commitsDir, emailFolder);
      const dateDir = path.join(emailDir, dateStr);
      
      await fs.mkdir(dateDir, { recursive: true });
      
      // Crear archivo markdown
      const fileName = `commit_${commitIndex}.md`;
      const filePath = path.join(dateDir, fileName);
      
      const markdownContent = this.generateMarkdownContent(commitData, commitIndex, originalEmail);
      await fs.writeFile(filePath, markdownContent);
      
      // Obtener ruta relativa desde la raíz del repo
      const relativePath = path.relative(this.repoPath, filePath);
      
      // Agregar archivo al git (usando --force para bypass .gitignore)
      await this.git.add(['--force', relativePath]);
      
      // Crear commit con fecha original
      const commitMessage = commitData.message || `Commit ${commitIndex}`;
      
      await this.git.env({
        GIT_AUTHOR_DATE: commitData.date,
        GIT_COMMITTER_DATE: commitData.date,
        GIT_AUTHOR_EMAIL: originalEmail,
        GIT_COMMITTER_EMAIL: originalEmail
      }).commit(commitMessage);
      
      // Mostrar progreso
      console.log(chalk.green(`  ✅ ${dateStr} - ${fileName} (${commitIndex}/${totalCommits})`));
      
    } catch (error) {
      console.error(chalk.red(`❌ Error creando commit ${commitIndex}:`), error.message);
    }
  }

  generateMarkdownContent(commitData, commitIndex, originalEmail) {
    const date = new Date(commitData.date);
    const formattedDate = date.toISOString().replace('T', ' ').split('.')[0];
    const replicationDate = new Date().toISOString().replace('T', ' ').split('.')[0];
    
    return `# Commit Replicado

## Información Original
- **Fecha**: ${formattedDate}
- **Repositorio**: ${commitData.repo || 'undefined'}
- **Owner**: ${commitData.owner || 'undefined'}
- **SHA Original**: ${commitData.sha}
- **Email Original**: ${originalEmail}

## Mensaje Original
${commitData.message || 'Sin mensaje'}

## Detalles
- **Commit #**: ${commitIndex}
- **Fecha de Replicación**: ${replicationDate}
- **Repositorio URL**: ${commitData.repoUrl || 'undefined'}

---

*Este commit fue replicado automáticamente por CommitFaker para hacer visible el trabajo realizado con la cuenta ${originalEmail}*

## Archivos Modificados en el Commit Original
${commitData.files && commitData.files.length > 0 ? 
  commitData.files.map(file => `- ${file}`).join('\n') : 
  'Información no disponible'}

---
**CommitFaker v1.0.0** - Email Sync Feature
`;
  }
}

// Ejecutar el script
async function main() {
  const committer = new MarkdownCommitter();
  await committer.run();
}

main().catch(error => {
  console.error(chalk.red('❌ Error fatal:'), error);
  process.exit(1);
});
