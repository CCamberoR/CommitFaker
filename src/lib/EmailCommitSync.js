import chalk from 'chalk';
import { Octokit } from '@octokit/rest';
import moment from 'moment';
import fs from 'fs/promises';
import path from 'path';
import simpleGit from 'simple-git';
import { config } from '../config/config.js';

export class EmailCommitSync {
  constructor() {
    this.octokit = new Octokit({
      auth: config.github.token,
    });
    this.repoPath = path.join(process.cwd(), config.repo.defaultName);
    this.git = null; // Initialize later when needed
  }

  async initializeGit() {
    if (!this.git) {
      // Ensure directory exists first
      await fs.mkdir(this.repoPath, { recursive: true });
      this.git = simpleGit(this.repoPath);
    }
    return this.git;
  }

  async syncEmailCommits(options = {}) {
    try {
      console.log(chalk.blue('📧 Iniciando sincronización de commits por email...'));
      
      if (options.all) {
        return await this.syncAllEmails(options);
      }
      
      const email = options.email || config.sync.defaultEmail;
      const autoConfirm = options.autoConfirm !== undefined ? options.autoConfirm : config.sync.autoConfirm;
      
      console.log(chalk.yellow(`🔍 Buscando commits para: ${email}`));
      
      const commits = await this.findCommitsByEmail(email);
      
      if (commits.length === 0) {
        console.log(chalk.yellow('⚠️ No se encontraron commits para este email'));
        return;
      }
      
      console.log(chalk.green(`✅ Encontrados ${commits.length} commits`));
      this.showCommitsSummary(commits, email);
      
      if (autoConfirm || await this.confirmReplication(commits.length)) {
        await this.replicateCommits(commits, email);
      }
      
    } catch (error) {
      console.error(chalk.red('❌ Error en sincronización:'), error.message);
      throw error;
    }
  }

  async syncAllEmails(options = {}) {
    try {
      console.log(chalk.blue('📬 Sincronizando todos los emails configurados...'));
      
      const emails = config.sync.emails;
      const autoConfirm = options.autoConfirm !== undefined ? options.autoConfirm : config.sync.autoConfirm;
      
      let totalCommits = 0;
      const allCommits = {};
      
      for (const email of emails) {
        console.log(chalk.yellow(`🔍 Buscando commits para: ${email}`));
        const commits = await this.findCommitsByEmail(email);
        
        if (commits.length > 0) {
          allCommits[email] = commits;
          totalCommits += commits.length;
          console.log(chalk.green(`✅ ${email}: ${commits.length} commits`));
        } else {
          console.log(chalk.gray(`➖ ${email}: 0 commits`));
        }
      }
      
      if (totalCommits === 0) {
        console.log(chalk.yellow('⚠️ No se encontraron commits para ningún email'));
        return;
      }
      
      console.log(chalk.blue(`\n📊 Resumen total: ${totalCommits} commits en ${Object.keys(allCommits).length} emails`));
      
      if (autoConfirm || await this.confirmReplication(totalCommits)) {
        for (const [email, commits] of Object.entries(allCommits)) {
          await this.replicateCommits(commits, email);
        }
      }
      
    } catch (error) {
      console.error(chalk.red('❌ Error en sincronización masiva:'), error.message);
      throw error;
    }
  }

  async findCommitsByEmail(email) {
    try {
      const commits = [];
      const repos = await this.getAllUserRepos();
      
      console.log(chalk.gray(`🔍 Analizando ${repos.length} repositorios...`));
      
      for (let i = 0; i < repos.length; i++) {
        const repo = repos[i];
        
        try {
          const repoCommits = await this.getCommitsFromRepo(repo.name, email);
          commits.push(...repoCommits);
          
          if (repoCommits.length > 0) {
            console.log(chalk.gray(`📦 ${repo.name}: ${repoCommits.length} commits`));
          }
          
          // Pausa para evitar rate limiting
          await this.delay(config.github.apiDelay);
          
        } catch (error) {
          console.log(chalk.red(`❌ Error en ${repo.name}: ${error.message}`));
        }
        
        if (i % 10 === 0) {
          console.log(chalk.gray(`Progreso: ${i + 1}/${repos.length} repositorios`));
        }
      }
      
      // Ordenar commits por fecha
      commits.sort((a, b) => new Date(a.date) - new Date(b.date));
      
      return commits;
      
    } catch (error) {
      console.error(chalk.red('❌ Error buscando commits:'), error.message);
      throw error;
    }
  }

  async getAllUserRepos() {
    try {
      const repos = [];
      let page = 1;
      
      while (true) {
        const response = await this.octokit.repos.listForAuthenticatedUser({
          per_page: 100,
          page: page,
          type: config.sync.includePrivateRepos ? 'all' : 'public'
        });
        
        if (response.data.length === 0) break;
        
        repos.push(...response.data.map(repo => ({
          name: repo.name,
          fullName: repo.full_name,
          private: repo.private,
          fork: repo.fork
        })));
        
        page++;
      }
      
      return repos;
      
    } catch (error) {
      console.error(chalk.red('❌ Error obteniendo repositorios:'), error.message);
      throw error;
    }
  }

  async getCommitsFromRepo(repo, email) {
    try {
      const commits = [];
      let page = 1;
      
      // Determinar owner y nombre del repo
      let owner, repoName;
      if (typeof repo === 'string') {
        // Si es string, usar el username configurado como owner
        owner = config.github.username;
        repoName = repo;
      } else {
        // Si es objeto, extraer owner de full_name
        const fullNameParts = repo.fullName.split('/');
        owner = fullNameParts[0];
        repoName = repo.name;
      }
      
      console.log(chalk.gray(`   → Buscando en ${owner}/${repoName} commits del email ${email}`));
      
      while (true) {
        const response = await this.octokit.repos.listCommits({
          owner: owner,
          repo: repoName,
          per_page: 100,
          page: page
        });
        
        if (response.data.length === 0) break;
        
        for (const commit of response.data) {
          // Verificar tanto commit.commit.author.email como commit.author.email
          const commitEmail = commit.commit.author?.email;
          const authorEmail = commit.author?.email;
          
          if (commitEmail === email || authorEmail === email) {
            commits.push({
              sha: commit.sha,
              message: commit.commit.message,
              date: commit.commit.author.date,
              email: email,
              repo: repoName,
              owner: owner,
              url: commit.html_url
            });
          }
        }
        
        page++;
        
        // Limitar para evitar demasiadas requests
        if (page > 10) break;
      }
      
      if (commits.length > 0) {
        console.log(chalk.green(`     ✅ Encontrados ${commits.length} commits`));
      }
      
      return commits;
      
    } catch (error) {
      // No todos los repos tienen commits del usuario
      if (error.status === 409 || error.status === 404) {
        console.log(chalk.yellow(`     ⚠️ Sin acceso o sin commits: ${error.message}`));
        return [];
      }
      console.log(chalk.red(`     ❌ Error: ${error.message}`));
      throw error;
    }
  }

  async syncSingleRepository(repoUrl, options = {}) {
    try {
      console.log(chalk.blue(`🔄 Sincronizando repositorio: ${repoUrl}`));
      
      // Extraer owner y repo de la URL
      const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
      if (!match) {
        throw new Error('URL de repositorio inválida');
      }
      
      const [, owner, repo] = match;
      const email = options.email || config.sync.defaultEmail;
      
      console.log(chalk.yellow(`🔍 Buscando commits de ${email} en ${owner}/${repo}`));
      
      const commits = await this.getCommitsFromSpecificRepo(owner, repo, email);
      
      if (commits.length === 0) {
        console.log(chalk.yellow('⚠️ No se encontraron commits para este email en el repositorio'));
        return;
      }
      
      console.log(chalk.green(`✅ Encontrados ${commits.length} commits`));
      this.showCommitsSummary(commits, email);
      
      const autoConfirm = options.autoConfirm !== undefined ? options.autoConfirm : config.sync.autoConfirm;
      
      if (autoConfirm || await this.confirmReplication(commits.length)) {
        await this.replicateCommits(commits, email, `${owner}-${repo}`);
      }
      
    } catch (error) {
      console.error(chalk.red('❌ Error sincronizando repositorio:'), error.message);
      throw error;
    }
  }

  async syncEmailFromSelectedRepo(options = {}) {
    try {
      console.log(chalk.blue('� Seleccionar email a replicar y repositorio destino...'));
      
      // Paso 1: Seleccionar email
      const inquirer = await import('inquirer');
      const emails = config.sync.emails;
      
      const emailChoices = [
        ...emails.map(email => ({ name: `� ${email}`, value: email })),
        { name: '✏️  Especificar otro email', value: 'custom' }
      ];
      
      const emailAnswer = await inquirer.default.prompt([
        {
          type: 'list',
          name: 'email',
          message: '¿De qué email quieres replicar commits?',
          choices: emailChoices
        }
      ]);
      
      let selectedEmail = emailAnswer.email;
      
      if (selectedEmail === 'custom') {
        const customEmailAnswer = await inquirer.default.prompt([
          {
            type: 'input',
            name: 'customEmail',
            message: 'Introduce el email:',
            validate: (input) => input.includes('@') || 'Por favor introduce un email válido'
          }
        ]);
        selectedEmail = customEmailAnswer.customEmail;
      }
      
      console.log(chalk.blue(`🎯 Buscando commits del email: ${selectedEmail}`));
      console.log(chalk.gray('   → Después podrás elegir a cuál de tus repositorios replicar los commits'));
      
      // Paso 2: Seleccionar repositorio fuente (donde buscar commits)
      console.log(chalk.yellow('🔍 Obteniendo tu lista de repositorios...'));
      const repos = await this.getAllUserRepos();
      
      if (repos.length === 0) {
        console.log(chalk.yellow('⚠️ No se encontraron repositorios en tu cuenta'));
        return;
      }
      
      const repoChoices = repos.map(repo => ({
        name: `${repo.private ? '🔒' : '📖'} ${repo.fullName} ${repo.fork ? '(fork)' : ''}`,
        value: repo
      }));
      
      const repoAnswer = await inquirer.default.prompt([
        {
          type: 'list',
          name: 'sourceRepo',
          message: `¿En cuál de tus repositorios quieres buscar commits del email ${selectedEmail}?`,
          choices: repoChoices,
          pageSize: 15
        }
      ]);
      
      const sourceRepo = repoAnswer.sourceRepo;
      
      // Paso 3: Buscar commits del email en el repositorio seleccionado
      console.log(chalk.yellow(`🔍 Buscando commits de ${selectedEmail} en ${sourceRepo.name}...`));
      const commits = await this.getCommitsFromRepo(sourceRepo, selectedEmail);
      
      if (commits.length === 0) {
        console.log(chalk.yellow(`⚠️ No se encontraron commits del email ${selectedEmail} en ${sourceRepo.name}`));
        return;
      }
      
      console.log(chalk.green(`✅ Encontrados ${commits.length} commits del email ${selectedEmail} en ${sourceRepo.name}`));
      this.showCommitsSummary(commits, selectedEmail);
      
      // Paso 4: Confirmar replicación
      const confirmAnswer = await inquirer.default.prompt([
        {
          type: 'confirm',
          name: 'autoConfirm',
          message: `¿Replicar estos ${commits.length} commits al repositorio commit-history?`,
          default: options.autoConfirm !== undefined ? options.autoConfirm : config.sync.autoConfirm
        }
      ]);
      
      if (confirmAnswer.autoConfirm) {
        console.log(chalk.blue(`📦 Replicando ${commits.length} commits hacia: commit-history`));
        await this.replicateCommits(commits, selectedEmail, config.repo.defaultName);
        console.log(chalk.green(`✅ Commits replicados exitosamente en commit-history`));
      } else {
        console.log(chalk.yellow('🚫 Replicación cancelada'));
      }
      
    } catch (error) {
      console.error(chalk.red('❌ Error en replicación de commits:'), error.message);
      throw error;
    }
  }

  async getCommitsFromSpecificRepo(owner, repo, email) {
    try {
      const commits = [];
      let page = 1;
      
      console.log(chalk.gray(`   → Buscando en ${owner}/${repo} commits del email ${email}`));
      
      while (true) {
        const response = await this.octokit.repos.listCommits({
          owner: owner,
          repo: repo,
          per_page: 100,
          page: page
        });
        
        if (response.data.length === 0) break;
        
        for (const commit of response.data) {
          // Verificar tanto commit.commit.author.email como commit.author.email
          const commitEmail = commit.commit.author?.email;
          const authorEmail = commit.author?.email;
          
          if (commitEmail === email || authorEmail === email) {
            commits.push({
              sha: commit.sha,
              message: commit.commit.message,
              date: commit.commit.author.date,
              email: email,
              repo: `${owner}/${repo}`,
              url: commit.html_url
            });
          }
        }
        
        page++;
      }
      
      if (commits.length > 0) {
        console.log(chalk.green(`     ✅ Encontrados ${commits.length} commits`));
      }
      
      return commits.sort((a, b) => new Date(a.date) - new Date(b.date));
      
    } catch (error) {
      if (error.status === 404) {
        throw new Error('Repositorio no encontrado o sin acceso');
      }
      throw error;
    }
  }

  showCommitsSummary(commits, email) {
    console.log(chalk.blue('\n📊 Resumen de commits encontrados:'));
    console.log(chalk.gray(`Email: ${email}`));
    console.log(chalk.gray(`Total commits: ${commits.length}`));
    
    if (commits.length > 0) {
      const firstCommit = moment(commits[0].date);
      const lastCommit = moment(commits[commits.length - 1].date);
      console.log(chalk.gray(`Rango de fechas: ${firstCommit.format('YYYY-MM-DD')} - ${lastCommit.format('YYYY-MM-DD')}`));
      
      // Mostrar repos únicos
      const repos = [...new Set(commits.map(c => c.repo))];
      console.log(chalk.gray(`Repositorios: ${repos.length}`));
      repos.slice(0, 5).forEach(repo => console.log(chalk.gray(`  - ${repo}`)));
      if (repos.length > 5) {
        console.log(chalk.gray(`  ... y ${repos.length - 5} más`));
      }
    }
    console.log('');
  }

  async confirmReplication(totalCommits) {
    const inquirer = await import('inquirer');
    const answers = await inquirer.default.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `¿Replicar ${totalCommits} commits en el repositorio local?`,
        default: true
      }
    ]);
    return answers.confirm;
  }

  async replicateCommits(commits, email, suffix = '') {
    try {
      console.log(chalk.blue(`🔄 Replicando ${commits.length} commits...`));
      
      // Asegurar que el repositorio esté configurado
      const commitFaker = (await import('./CommitFaker.js')).CommitFaker;
      const faker = new commitFaker();
      await faker.setupRepository();
      
      // Inicializar git para esta clase
      await this.initializeGit();
      
      const emailSanitized = email.replace('@', '_at_').replace(/\./g, '_');
      const folderSuffix = suffix ? `_${suffix}` : '';
      
      for (let i = 0; i < commits.length; i++) {
        const commit = commits[i];
        await this.replicateCommit(commit, emailSanitized + folderSuffix);
        
        if (i % 10 === 0) {
          console.log(chalk.gray(`Progreso: ${i + 1}/${commits.length}`));
        }
      }
      
      console.log(chalk.green(`✅ ${commits.length} commits replicados exitosamente`));
      
      // Guardar metadatos
      await this.saveReplicationMetadata(commits, email, suffix);
      
    } catch (error) {
      console.error(chalk.red('❌ Error replicando commits:'), error.message);
      throw error;
    }
  }

  async replicateCommit(commit, folderName) {
    const date = moment(commit.date);
    const dateStr = date.format('YYYY-MM-DD');
    
    const commitsDir = config.sync.createSeparateFolders 
      ? path.join(this.repoPath, 'commits', folderName, dateStr)
      : path.join(this.repoPath, 'commits', 'all_emails', dateStr);
    
    await fs.mkdir(commitsDir, { recursive: true });
    
    // Generar archivo markdown en lugar de txt
    const fileName = `${commit.sha.substring(0, 8)}.md`;
    const filePath = path.join(commitsDir, fileName);
    
    const markdownContent = this.generateMarkdownContent(commit);
    
    await fs.writeFile(filePath, markdownContent);
    
    // Obtener ruta relativa desde la raíz del repo
    const relativePath = path.relative(this.repoPath, filePath);
    
    // Agregar archivo al git (usando --force para bypass .gitignore)
    await this.git.add(['--force', relativePath]);
    
    const replicatedMessage = `[REPLICATED] ${commit.message} (from ${commit.repo})`;
    const commitDate = commit.date;
    
    await this.git.env({
      GIT_AUTHOR_DATE: commitDate,
      GIT_COMMITTER_DATE: commitDate,
      GIT_AUTHOR_EMAIL: commit.email,
      GIT_COMMITTER_EMAIL: commit.email
    }).commit(replicatedMessage);
  }

  generateMarkdownContent(commit) {
    const date = new Date(commit.date);
    const formattedDate = date.toISOString().replace('T', ' ').split('.')[0];
    const replicationDate = new Date().toISOString().replace('T', ' ').split('.')[0];
    
    return `# Commit Replicado

## Información Original
- **Fecha**: ${formattedDate}
- **Repositorio**: ${commit.repo || 'undefined'}
- **Owner**: ${commit.owner || 'undefined'}
- **SHA Original**: ${commit.sha}
- **Email Original**: ${commit.email}

## Mensaje Original
${commit.message || 'Sin mensaje'}

## Detalles
- **SHA Corto**: ${commit.sha.substring(0, 8)}
- **Fecha de Replicación**: ${replicationDate}
- **URL Original**: ${commit.url || 'undefined'}

---

*Este commit fue replicado automáticamente por CommitFaker para hacer visible el trabajo realizado con la cuenta ${commit.email}*

## Información Adicional
- **Repositorio Fuente**: ${commit.repo}
- **Fecha Original**: ${commit.date}

---
**CommitFaker v1.0.0** - Email Sync Feature
`;
  }

  async saveReplicationMetadata(commits, email, suffix = '') {
    const metadataDir = path.join(this.repoPath, 'sync-data');
    await fs.mkdir(metadataDir, { recursive: true });
    
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const fileName = `replication_${email.replace('@', '_at_')}_${suffix}_${timestamp}.json`;
    const filePath = path.join(metadataDir, fileName);
    
    const metadata = {
      email,
      suffix,
      timestamp,
      totalCommits: commits.length,
      dateRange: {
        first: commits[0]?.date,
        last: commits[commits.length - 1]?.date
      },
      repositories: [...new Set(commits.map(c => c.repo))],
      commits: commits.map(c => ({
        sha: c.sha,
        date: c.date,
        repo: c.repo,
        message: c.message.substring(0, 100)
      }))
    };
    
    await fs.writeFile(filePath, JSON.stringify(metadata, null, 2));
    console.log(chalk.gray(`💾 Metadatos guardados en: ${fileName}`));
  }

  getAvailableEmails() {
    return config.sync.emails;
  }

  showEmailSummary() {
    console.log(chalk.blue('📧 Emails configurados para sincronización:\n'));
    
    config.sync.emails.forEach((email, index) => {
      const isDefault = email === config.sync.defaultEmail;
      const marker = isDefault ? '⭐' : '📧';
      console.log(`${marker} ${email}${isDefault ? ' (por defecto)' : ''}`);
    });
    
    console.log(chalk.gray(`\n📝 Email por defecto: ${config.sync.defaultEmail}`));
    console.log(chalk.gray(`🔧 Configuración en archivo .env`));
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
