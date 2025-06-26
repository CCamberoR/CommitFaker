import chalk from 'chalk';
import moment from 'moment';

export class PatternGenerator {
  constructor() {
    this.patterns = {
      growth: this.generateGrowthPattern,
      wave: this.generateWavePattern,
      spikes: this.generateSpikesPattern,
      cycle: this.generateCyclicPattern
    };
  }

  async generatePattern(options = {}) {
    try {
      const type = options.type || 'wave';
      const intensity = options.intensity || 'medium';
      
      console.log(chalk.blue(`🎨 Generando patrón: ${type}`));
      
      if (!this.patterns[type]) {
        throw new Error(`Patrón '${type}' no reconocido`);
      }
      
      const pattern = this.patterns[type](intensity);
      
      console.log(chalk.green(`✅ Patrón '${type}' generado con ${pattern.length} puntos`));
      
      return pattern;
      
    } catch (error) {
      console.error(chalk.red('❌ Error generando patrón:'), error.message);
      throw error;
    }
  }

  generateGrowthPattern(intensity) {
    const points = [];
    const days = 365;
    const maxCommits = this.getMaxCommits(intensity);
    
    for (let i = 0; i < days; i++) {
      const growth = Math.min(i / days, 1);
      const commits = Math.floor(growth * maxCommits * (0.5 + Math.random() * 0.5));
      
      points.push({
        day: i,
        commits: commits,
        date: moment().subtract(days - i, 'days').format('YYYY-MM-DD')
      });
    }
    
    return points;
  }

  generateWavePattern(intensity) {
    const points = [];
    const days = 365;
    const maxCommits = this.getMaxCommits(intensity);
    
    for (let i = 0; i < days; i++) {
      const wave = (Math.sin(i / days * Math.PI * 4) + 1) / 2;
      const commits = Math.floor(wave * maxCommits);
      
      points.push({
        day: i,
        commits: commits,
        date: moment().subtract(days - i, 'days').format('YYYY-MM-DD')
      });
    }
    
    return points;
  }

  generateSpikesPattern(intensity) {
    const points = [];
    const days = 365;
    const maxCommits = this.getMaxCommits(intensity);
    
    for (let i = 0; i < days; i++) {
      let commits = Math.floor(Math.random() * 2); // Base baja
      
      // Picos aleatorios
      if (Math.random() < 0.1) {
        commits = Math.floor(maxCommits * (0.5 + Math.random() * 0.5));
      }
      
      points.push({
        day: i,
        commits: commits,
        date: moment().subtract(days - i, 'days').format('YYYY-MM-DD')
      });
    }
    
    return points;
  }

  generateCyclicPattern(intensity) {
    const points = [];
    const days = 365;
    const maxCommits = this.getMaxCommits(intensity);
    const cycleLength = 7; // Semanal
    
    for (let i = 0; i < days; i++) {
      const cyclePos = i % cycleLength;
      let commits = 0;
      
      // Patrón de trabajo semanal
      if (cyclePos >= 1 && cyclePos <= 5) { // Lunes a Viernes
        commits = Math.floor(maxCommits * 0.7 * (0.5 + Math.random() * 0.5));
      } else if (cyclePos === 6) { // Sábado
        commits = Math.floor(maxCommits * 0.3 * Math.random());
      }
      // Domingo = 0 commits
      
      points.push({
        day: i,
        commits: commits,
        date: moment().subtract(days - i, 'days').format('YYYY-MM-DD')
      });
    }
    
    return points;
  }

  getMaxCommits(intensity) {
    const intensityMap = {
      low: 5,
      medium: 10,
      high: 20
    };
    
    return intensityMap[intensity] || intensityMap.medium;
  }
}
