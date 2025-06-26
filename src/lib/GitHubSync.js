import chalk from 'chalk';
import { Octokit } from '@octokit/rest';
import { config } from '../config/config.js';

export class GitHubSync {
  constructor() {
    this.octokit = new Octokit({
      auth: config.github.token,
    });
  }

  async syncForkedRepos() {
    try {
      console.log(chalk.blue('🔄 Sincronizando commits de repositorios fork...'));
      
      const forks = await this.getForkedRepos();
      
      if (forks.length === 0) {
        console.log(chalk.yellow('⚠️ No se encontraron repositorios fork'));
        return;
      }
      
      console.log(chalk.green(`✅ Encontrados ${forks.length} forks`));
      
      for (const fork of forks) {
        console.log(chalk.gray(`🔍 Procesando: ${fork.full_name}`));
        await this.syncCommitsFromFork(fork);
      }
      
      console.log(chalk.green('✅ Sincronización de forks completada'));
      
    } catch (error) {
      console.error(chalk.red('❌ Error sincronizando forks:'), error.message);
      throw error;
    }
  }

  async getForkedRepos() {
    try {
      const repos = [];
      let page = 1;
      
      while (true) {
        const response = await this.octokit.repos.listForAuthenticatedUser({
          per_page: 100,
          page: page,
          type: 'all'
        });
        
        if (response.data.length === 0) break;
        
        const forks = response.data.filter(repo => repo.fork);
        repos.push(...forks);
        
        page++;
      }
      
      return repos;
      
    } catch (error) {
      console.error(chalk.red('❌ Error obteniendo forks:'), error.message);
      throw error;
    }
  }

  async syncCommitsFromFork(fork) {
    try {
      const commits = await this.getCommitsFromFork(fork);
      
      if (commits.length === 0) {
        console.log(chalk.gray(`➖ ${fork.name}: 0 commits propios`));
        return;
      }
      
      console.log(chalk.green(`✅ ${fork.name}: ${commits.length} commits`));
      
      // Aquí podrías implementar la lógica para replicar los commits
      // Similar a EmailCommitSync.replicateCommits()
      
    } catch (error) {
      console.log(chalk.red(`❌ Error en ${fork.name}: ${error.message}`));
    }
  }

  async getCommitsFromFork(fork) {
    try {
      const commits = [];
      
      const response = await this.octokit.repos.listCommits({
        owner: config.github.username,
        repo: fork.name,
        author: config.github.username,
        per_page: 100
      });
      
      return response.data.filter(commit => 
        commit.author && commit.author.login === config.github.username
      );
      
    } catch (error) {
      return [];
    }
  }

  async showStats() {
    try {
      console.log(chalk.blue('📈 Obteniendo estadísticas de GitHub...'));
      
      const user = await this.octokit.users.getAuthenticated();
      const repos = await this.octokit.repos.listForAuthenticatedUser({
        per_page: 100,
        type: 'all'
      });
      
      const forks = repos.data.filter(repo => repo.fork);
      const ownRepos = repos.data.filter(repo => !repo.fork);
      
      console.log(chalk.blue('\n📊 Estadísticas de GitHub:'));
      console.log(chalk.gray(`Usuario: ${user.data.login}`));
      console.log(chalk.gray(`Repositorios propios: ${ownRepos.length}`));
      console.log(chalk.gray(`Repositorios fork: ${forks.length}`));
      console.log(chalk.gray(`Total repositorios: ${repos.data.length}`));
      console.log(chalk.gray(`Seguidores: ${user.data.followers}`));
      console.log(chalk.gray(`Siguiendo: ${user.data.following}`));
      
    } catch (error) {
      console.error(chalk.red('❌ Error obteniendo estadísticas:'), error.message);
    }
  }
}
