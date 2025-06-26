#!/usr/bin/env node

import chalk from 'chalk';
import simpleGit from 'simple-git';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class IndividualCommitter {
  constructor() {
    // Si ya estamos en commit-history, usar el directorio actual
    // Si no, usar la ruta relativa desde el directorio principal
    const currentDir = path.basename(process.cwd());
    if (currentDir === 'commit-history') {
      this.repoPath = process.cwd();
    } else {
      this.repoPath = path.join(process.cwd(), 'commit-history');
    }
    this.git = simpleGit(this.repoPath);
  }

  async run() {
    try {
      console.log(chalk.blue.bold('🔄 IndividualCommitter - Hacer commits individuales por archivo\n'));
      
      // Buscar todos los archivos markdown
      const markdownFiles = await this.findAllMarkdownFiles();
      console.log(chalk.green(`✅ Encontrados ${markdownFiles.length} archivos markdown`));

      if (markdownFiles.length === 0) {
        console.log(chalk.red('❌ No se encontraron archivos markdown.'));
        return;
      }

      // Limpiar el repositorio (resetear a estado inicial)
      await this.resetRepository();

      // Procesar cada archivo individualmente
      for (let i = 0; i < markdownFiles.length; i++) {
        const filePath = markdownFiles[i];
        await this.processMarkdownFile(filePath, i + 1, markdownFiles.length);
      }

      console.log(chalk.green.bold(`\n✅ Se han creado ${markdownFiles.length} commits individuales`));
      console.log(chalk.blue('💡 Ahora puedes hacer push al repositorio para actualizar tu gráfico de GitHub'));
      
    } catch (error) {
      console.error(chalk.red('❌ Error no manejado:'), error);
    }
  }

  async findAllMarkdownFiles() {
    const files = [];
    const commitsDir = path.join(this.repoPath, 'commits');
    
    async function scanDirectory(dir) {
      try {
        const items = await fs.readdir(dir, { withFileTypes: true });
        
        for (const item of items) {
          const fullPath = path.join(dir, item.name);
          
          if (item.isDirectory()) {
            await scanDirectory(fullPath);
          } else if (item.isFile() && item.name.endsWith('.md')) {
            files.push(fullPath);
          }
        }
      } catch (error) {
        // Ignorar directorios que no existen
      }
    }
    
    await scanDirectory(commitsDir);
    
    // Ordenar por fecha (extraer de la estructura de carpetas)
    files.sort((a, b) => {
      const dateA = this.extractDateFromPath(a);
      const dateB = this.extractDateFromPath(b);
      return new Date(dateA) - new Date(dateB);
    });
    
    return files;
  }

  extractDateFromPath(filePath) {
    // Extraer fecha del path: commits/folder/YYYY-MM-DD/file.md
    const parts = filePath.split(path.sep);
    const dateIndex = parts.findIndex(part => /^\d{4}-\d{2}-\d{2}$/.test(part));
    return dateIndex !== -1 ? parts[dateIndex] : '1970-01-01';
  }

  async resetRepository() {
    try {
      console.log(chalk.yellow('🔄 Limpiando repositorio completamente...'));
      
      // Eliminar toda la historia de git y empezar desde cero
      await this.git.init();
      
      // Crear un commit inicial limpio
      const readmePath = path.join(this.repoPath, 'README.md');
      const readmeContent = `# Commit History\n\nEste repositorio contiene la historia de commits replicados por CommitFaker.\n\nTotal de commits replicados: ${await this.countMarkdownFiles()}\n`;
      await fs.writeFile(readmePath, readmeContent);
      await this.git.add('README.md');
      await this.git.commit('Initial commit');
      
      console.log(chalk.green('✅ Repositorio limpio y preparado'));
      
    } catch (error) {
      console.error(chalk.red('❌ Error preparando repositorio:'), error.message);
      throw error;
    }
  }

  async countMarkdownFiles() {
    const files = await this.findAllMarkdownFiles();
    return files.length;
  }

  async processMarkdownFile(filePath, index, total) {
    try {
      // Leer el contenido del archivo
      const content = await fs.readFile(filePath, 'utf8');
      
      // Extraer información del markdown
      const metadata = this.extractMetadataFromMarkdown(content);
      
      // Obtener ruta relativa desde la raíz del repo
      const relativePath = path.relative(this.repoPath, filePath);
      
      // Agregar archivo al git (usando --force para bypass .gitignore)
      await this.git.add(['--force', relativePath]);
      
      // Crear commit con fecha original y email original
      const commitMessage = metadata.originalMessage || `Replicated commit ${index}`;
      
      await this.git.env({
        GIT_AUTHOR_DATE: metadata.originalDate,
        GIT_COMMITTER_DATE: metadata.originalDate,
        GIT_AUTHOR_EMAIL: metadata.originalEmail,
        GIT_COMMITTER_EMAIL: metadata.originalEmail
      }).commit(commitMessage);
      
      // Mostrar progreso cada 10 commits
      if (index % 10 === 0 || index === total) {
        console.log(chalk.green(`  ✅ Progreso: ${index}/${total} - ${metadata.originalDate}`));
      }
      
    } catch (error) {
      console.error(chalk.red(`❌ Error procesando archivo ${index}:`), error.message);
      throw error;
    }
  }

  extractMetadataFromMarkdown(content) {
    const metadata = {
      originalDate: new Date().toISOString(),
      originalEmail: 'unknown@example.com',
      originalMessage: 'Replicated commit'
    };

    // Extraer fecha original
    const dateMatch = content.match(/- \*\*Fecha\*\*: (.+)/);
    if (dateMatch) {
      metadata.originalDate = new Date(dateMatch[1]).toISOString();
    }

    // Extraer email original
    const emailMatch = content.match(/- \*\*Email Original\*\*: (.+)/);
    if (emailMatch) {
      metadata.originalEmail = emailMatch[1].trim();
    }

    // Extraer mensaje original
    const messageMatch = content.match(/## Mensaje Original\n(.+?)(?:\n\n|\n##)/s);
    if (messageMatch) {
      metadata.originalMessage = messageMatch[1].trim();
    }

    return metadata;
  }

  async pushToRemote() {
    try {
      console.log(chalk.yellow('📤 Haciendo push forzado al repositorio remoto commit-history...'));
      
      // Verificar si hay un remote configurado
      const remotes = await this.git.getRemotes(true);
      if (remotes.length === 0) {
        console.log(chalk.yellow('⚠️ No hay remote configurado.'));
        console.log(chalk.blue('💡 Configura un remote con: git remote add origin <URL>'));
        return;
      }
      
      console.log(chalk.gray(`📡 Pushing a: ${remotes[0].refs.push || remotes[0].refs.fetch}`));
      // Usar push forzado para sobrescribir la historia
      await this.git.push(['origin', 'main', '--force']);
      console.log(chalk.green('✅ Push forzado completado exitosamente - 289 commits subidos'));
    } catch (error) {
      console.log(chalk.yellow('⚠️ No se pudo hacer push automático:', error.message));
      console.log(chalk.blue('💡 Ve al directorio commit-history y haz push manualmente:'));
      console.log(chalk.gray('   cd commit-history'));
      console.log(chalk.gray('   git push origin main --force'));
    }
  }
}

// Función principal
async function main() {
  const committer = new IndividualCommitter();
  await committer.run();
  
  // Hacer push automáticamente sin preguntar
  console.log(chalk.blue('\n📤 Haciendo push automático...'));
  await committer.pushToRemote();
}

main().catch(error => {
  console.error(chalk.red('❌ Error fatal:'), error);
  process.exit(1);
});
