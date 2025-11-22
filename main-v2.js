// main-v2.js - Interface principal otimizada
import ranges from './ranges.js';
import BitcoinFinder from './bitcoin-find-v2.js';
import walletsArray from './wallets.js';
import readline from 'readline';
import chalk from 'chalk';
import os from 'os';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

let shouldStop = false;

function displayHeader() {
  console.clear();
  console.log("\x1b[38;2;250;128;114m" + "╔════════════════════════════════════════════════════════╗\n" +
    "║" + "\x1b[0m" + "\x1b[36m" + " ____ _____ ____ _____ ___ _ _ ____ _____ ____ " + "\x1b[0m" + "\x1b[38;2;250;128;114m" + "║\n" +
    "║" + "\x1b[0m" + "\x1b[36m" + " | __ )_ _/ ___| | ___|_ _| \\ | | _ \\| ____| _ \\ " + "\x1b[0m" + "\x1b[38;2;250;128;114m" + "║\n" +
    "║" + "\x1b[0m" + "\x1b[36m" + " | _ \\ | || | | |_ | || \\| | | | | _| | |_) | " + "\x1b[0m" + "\x1b[38;2;250;128;114m" + "║\n" +
    "║" + "\x1b[0m" + "\x1b[36m" + " | |_) || || |___ | _| | || |\\ | |_| | |___| _ < " + "\x1b[0m" + "\x1b[38;2;250;128;114m" + "║\n" +
    "║" + "\x1b[0m" + "\x1b[36m" + " |____/ |_| \\____| |_| |___|_| \\_|____/|_____|_| \\_\\ " + "\x1b[0m" + "\x1b[38;2;250;128;114m" + "║\n" +
    "║" + "\x1b[0m" + "\x1b[36m" + " " + "\x1b[0m" + "\x1b[38;2;250;128;114m" + "║\n" +
    "╚══════════════════════" + chalk.green("v2.0 - OTIMIZADO") + "\x1b[0m\x1b[38;2;250;128;114m══════╝" + "\x1b[0m");

  console.log(chalk.cyan(`\n💻 CPU Cores disponíveis: ${os.cpus().length}`));
  console.log(chalk.cyan(`📦 Carteiras a verificar: ${walletsArray.length}\n`));
}

function selectRange() {
  displayHeader();

  rl.question(chalk.cyan(`Escolha uma carteira puzzle (${chalk.cyan(1)} - ${chalk.cyan(160)}): `), (answer) => {
    const puzzleNum = parseInt(answer);

    if (puzzleNum < 1 || puzzleNum > 160) {
      console.log(chalk.bgRed('❌ Erro: escolha um número entre 1 e 160'));
      selectRange();
      return;
    }

    const range = ranges[puzzleNum - 1];
    let min = BigInt(range.min);
    let max = BigInt(range.max);

    console.log(chalk.green(`\n✓ Carteira #${puzzleNum} selecionada`));
    console.log(chalk.yellow(`  Min: ${min.toString()}`));
    console.log(chalk.yellow(`  Max: ${max.toString()}`));
    console.log(chalk.yellow(`  Possíveis chaves: ${(max - min).toLocaleString('pt-BR')}`));

    let status = range.status === 1 ? chalk.red('❌ Encontrada') : chalk.green('✓ Não encontrada');
    console.log(chalk.cyan(`  Status: ${status}`));

    selectMode(min, max);
  });
}

function selectMode(min, max) {
  console.log(chalk.cyan('\n🎲 Modos de busca:'));
  console.log(chalk.cyan(`  ${chalk.cyan(1)} - Completamente aleatório (pura sorte)`));
  console.log(chalk.cyan(`  ${chalk.cyan(2)} - Aleatório com bias (influenciar a sorte)`));

  rl.question(chalk.cyan('\nEscolha: '), (answer) => {
    if (answer === '2') {
      rl.question(chalk.cyan('Escolha um número entre 0 e 1.000.000.000 (bias): '), (bias) => {
        startSearch(min, max, parseInt(bias));
      });
    } else {
      startSearch(min, max, 0);
    }
  });
}

async function startSearch(min, max, bias) {
  const finder = new BitcoinFinder(walletsArray, ranges, {
    numWorkers: os.cpus().length,
    outputFile: 'keys.txt',
    lastKeyFile: 'Ultima_chave.txt'
  });

  process.on('SIGINT', () => {
    console.log(chalk.red('\n⚠️  Parando busca...'));
    finder.stop();
    rl.close();
    process.exit(0);
  });

  const progressCallback = (msg) => {
    if (msg.type === 'progress') {
      finder.updateLastKey(msg.lastKey);
    }
  };

  await finder.search(min, max, progressCallback);

  console.log(chalk.yellow('\nBusca finalizada!'));
  rl.close();
}

selectRange();
