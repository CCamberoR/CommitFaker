import chalk from 'chalk';
import moment from 'moment';
import fs from 'fs/promises';
import path from 'path';
import simpleGit from 'simple-git';
import { config } from '../config/config.js';

export class CommitFaker {
  constructor() {
    this.repoPath = path.join(process.cwd(), config.repo.defaultName);
    this.git = null; // Initialize later when needed
  }

  async initializeGit() {
    if (!this.git) {
      this.git = simpleGit(this.repoPath);
    }
    return this.git;
  }

  async setupRepository() {
    try {
      console.log(chalk.blue('⚙️ Configurando repositorio...'));
      
      // Crear directorio si no existe
      await fs.mkdir(this.repoPath, { recursive: true });
      
      // Inicializar git después de crear el directorio
      await this.initializeGit();
      
      // Inicializar git si no existe
      try {
        await this.git.status();
      } catch (error) {
        console.log(chalk.yellow('Inicializando repositorio Git...'));
        await this.git.init();
        await this.git.addConfig('user.name', config.github.username);
        await this.git.addConfig('user.email', config.sync.defaultEmail);
      }
      
      // Crear archivo README
      const readmePath = path.join(this.repoPath, 'README.md');
      const readmeContent = `# ${config.repo.defaultName}

Este repositorio contiene el historial de commits sincronizados para actualizar el gráfico de contribuciones de GitHub.

## Estructura

- \`commits/\`: Archivos de commits organizados por fecha
- \`sync-data/\`: Datos de sincronización y metadatos
- \`scripts/\`: Scripts auxiliares

## Generado por CommitFaker

Este repositorio fue generado automáticamente por CommitFaker para sincronizar commits de múltiples repositorios y emails.
`;
      
      await fs.writeFile(readmePath, readmeContent);
      
      // Crear estructura de directorios
      await fs.mkdir(path.join(this.repoPath, 'commits'), { recursive: true });
      await fs.mkdir(path.join(this.repoPath, 'sync-data'), { recursive: true });
      
      console.log(chalk.green('✅ Repositorio configurado correctamente'));
      console.log(chalk.gray(`📁 Ubicación: ${this.repoPath}`));
      
    } catch (error) {
      console.error(chalk.red('❌ Error configurando repositorio:'), error.message);
      throw error;
    }
  }

  async createFakeCommits(options = {}) {
    try {
      const startDate = moment(options.startDate || options.start || '2024-01-01');
      const endDate = moment(options.endDate || options.end || '2024-12-31');
      const pattern = options.pattern || 'random';
      const intensity = options.intensity || 'medium';
      
      console.log(chalk.blue(`🎯 Creando commits falsos desde ${startDate.format('YYYY-MM-DD')} hasta ${endDate.format('YYYY-MM-DD')}`));
      console.log(chalk.gray(`📊 Patrón: ${pattern}, Intensidad: ${intensity}`));
      
      await this.setupRepository();
      await this.initializeGit();
      
      const commits = this.generateCommitPattern(startDate, endDate, pattern, intensity);
      
      console.log(chalk.yellow(`📈 Generando ${commits.length} commits...`));
      
      for (let i = 0; i < commits.length; i++) {
        const commit = commits[i];
        await this.createCommitForDate(commit.date, commit.count, commit.message);
        
        if (i % 50 === 0) {
          console.log(chalk.gray(`Progreso: ${i + 1}/${commits.length}`));
        }
      }
      
      console.log(chalk.green('✅ Commits falsos creados exitosamente'));
      
    } catch (error) {
      console.error(chalk.red('❌ Error creando commits falsos:'), error.message);
      throw error;
    }
  }

  generateCommitPattern(startDate, endDate, pattern, intensity) {
    const commits = [];
    const current = startDate.clone();
    
    const intensityMap = {
      low: { min: 1, max: 3 },
      medium: { min: 3, max: 7 },
      high: { min: 7, max: 15 }
    };
    
    const { min, max } = intensityMap[intensity] || intensityMap.medium;
    
    while (current.isSameOrBefore(endDate)) {
      let count = 0;
      
      switch (pattern) {
        case 'random':
          count = Math.random() < 0.7 ? Math.floor(Math.random() * (max - min + 1)) + min : 0;
          break;
        case 'wave':
          const dayOfYear = current.dayOfYear();
          count = Math.floor((Math.sin(dayOfYear / 365 * Math.PI * 2) + 1) * max / 2);
          break;
        case 'streak':
          const streakLength = Math.floor(Math.random() * 10) + 5;
          for (let j = 0; j < streakLength && current.isSameOrBefore(endDate); j++) {
            commits.push({
              date: current.clone(),
              count: Math.floor(Math.random() * (max - min + 1)) + min,
              message: `Streak day ${j + 1}`
            });
            current.add(1, 'day');
          }
          continue;
        case 'custom':
          // Patrón personalizable
          count = this.getCustomPatternCount(current, min, max);
          break;
      }
      
      if (count > 0) {
        commits.push({
          date: current.clone(),
          count,
          message: `${pattern} pattern commit`
        });
      }
      
      current.add(1, 'day');
    }
    
    return commits;
  }

  getCustomPatternCount(date, min, max) {
    // Patrón personalizado: más actividad en días laborables
    const dayOfWeek = date.day();
    if (dayOfWeek === 0 || dayOfWeek === 6) { // Domingo o Sábado
      return Math.random() < 0.3 ? Math.floor(Math.random() * min) + 1 : 0;
    } else {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }
  }

  async createCommitForDate(date, count, baseMessage) {
    const dateStr = date.format('YYYY-MM-DD');
    const commitsDir = path.join(this.repoPath, 'commits', dateStr);
    
    await fs.mkdir(commitsDir, { recursive: true });
    
    for (let i = 0; i < count; i++) {
      const fileName = `commit-${i + 1}.txt`;
      const filePath = path.join(commitsDir, fileName);
      const content = `Commit ${i + 1} for ${dateStr}
Generated at: ${new Date().toISOString()}
Pattern: ${baseMessage}
Random data: ${Math.random().toString(36).substring(7)}
`;
      
      await fs.writeFile(filePath, content);
      await this.git.add(filePath);
      
      const commitMessage = `${baseMessage} - ${dateStr} (${i + 1}/${count})`;
      const commitDate = date.clone().add(i * 30, 'minutes').toISOString();
      
      await this.git.env({
        GIT_AUTHOR_DATE: commitDate,
        GIT_COMMITTER_DATE: commitDate
      }).commit(commitMessage);
    }
  }
}
