// bitcoin-find-v2.js - Versão otimizada com Worker Threads
import { Worker } from 'worker_threads';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import os from 'os';

export class BitcoinFinder {
  constructor(wallets, ranges, options = {}) {
    this.wallets = wallets;
    this.ranges = ranges;
    this.walletsSet = new Set(wallets);
    this.numWorkers = options.numWorkers || os.cpus().length;
    this.workers = [];
    this.stats = {
      totalKeysChecked: 0,
      totalKeysFound: 0,
      startTime: null,
      totalMatches: []
    };
    this.shouldStop = false;
    this.outputFile = options.outputFile || 'keys.txt';
    this.lastKeyFile = options.lastKeyFile || 'Ultima_chave.txt';
  }

  async search(min, max, callback) {
    this.stats.startTime = Date.now();

    console.log(chalk.cyan(`\n🚀 Iniciando busca com ${this.numWorkers} workers...`));
    console.log(chalk.yellow(`Range: ${min} - ${max}`));

    const promises = [];

    for (let i = 0; i < this.numWorkers; i++) {
      promises.push(this.createWorker(i, min, max, callback));
    }

    try {
      await Promise.all(promises);
      this.printFinalStats();
    } catch (err) {
      console.error(chalk.red('Erro na busca:'), err.message);
    }
  }

  createWorker(workerIndex, min, max, callback) {
    return new Promise((resolve, reject) => {
      try {
        const workerPath = new URL('./worker.js', import.meta.url).pathname;

        const worker = new Worker(workerPath, {
          workerData: {
            walletsSet: this.walletsSet,
            workerIndex,
            totalWorkers: this.numWorkers
          }
        });

        worker.on('message', (msg) => {
          if (msg.type === 'ready') {
            worker.postMessage({
              type: 'start',
              min: min.toString(),
              max: max.toString(),
              rand: 0
            });
          } else if (msg.type === 'progress') {
            this.stats.totalKeysChecked += msg.keysChecked;
            callback?.(msg);
          } else if (msg.type === 'match') {
            this.handleMatches(msg.matches);
          } else if (msg.type === 'complete') {
            this.stats.totalKeysFound += msg.keysFound;
            console.log(chalk.green(`✓ Worker ${msg.workerIndex} completou`));
            resolve();
          }
        });

        worker.on('error', (err) => {
          console.error(chalk.red(`Erro no worker ${workerIndex}:`), err);
          reject(err);
        });

        worker.on('exit', (code) => {
          if (code !== 0) {
            reject(new Error(`Worker ${workerIndex} saiu com código ${code}`));
          }
        });

        this.workers.push(worker);
      } catch (err) {
        reject(err);
      }
    });
  }

  handleMatches(matches) {
    for (const match of matches) {
      console.log(chalk.green(`\n🎉 ACHEI!!!`));
      console.log(chalk.green(`Private Key: ${match.privateKey}`));
      console.log(chalk.green(`WIF: ${match.wif}`));
      console.log(chalk.cyan(`Address: ${match.address}`));

      const line = `Private key: ${match.privateKey}, WIF: ${match.wif}, Address: ${match.address}\n`;
      try {
        fs.appendFileSync(this.outputFile, line, 'utf8');
        console.log(chalk.yellow('✓ Salvo em keys.txt'));
      } catch (err) {
        console.error(chalk.red('Erro ao escrever arquivo:'), err.message);
      }

      this.stats.totalMatches.push(match);
    }
  }

  updateLastKey(key) {
    try {
      fs.writeFileSync(this.lastKeyFile, `Ultima chave tentada: ${key}`, 'utf8');
    } catch (err) {
      console.error(chalk.red('Erro ao atualizar última chave:'), err.message);
    }
  }

  stop() {
    this.shouldStop = true;
    this.workers.forEach(worker => {
      worker.postMessage({ type: 'stop' });
      worker.terminate();
    });
  }

  printFinalStats() {
    const elapsed = (Date.now() - this.stats.startTime) / 1000;
    const keysPerSecond = this.stats.totalKeysChecked / elapsed;

    console.log(chalk.cyan('\n' + '='.repeat(50)));
    console.log(chalk.cyan('📊 ESTATÍSTICAS FINAIS'));
    console.log(chalk.cyan('='.repeat(50)));
    console.log(chalk.yellow(`Chaves verificadas: ${this.stats.totalKeysChecked.toLocaleString('pt-BR')}`));
    console.log(chalk.yellow(`Chaves encontradas: ${this.stats.totalKeysFound}`));
    console.log(chalk.yellow(`Tempo total: ${elapsed.toFixed(2)} segundos`));
    console.log(chalk.yellow(`Velocidade: ${keysPerSecond.toFixed(0)} chaves/segundo`));
    console.log(chalk.cyan('='.repeat(50) + '\n'));
  }
}

export default BitcoinFinder;
