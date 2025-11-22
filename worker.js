// worker.js - Thread worker para busca paralela de chaves
import crypto from 'crypto';
import secp256k1 from 'secp256k1';
import { parentPort, workerData } from 'worker_threads';

const { walletsSet, workerIndex, totalWorkers } = workerData;

let keysChecked = 0;
let keysFound = 0;

function getPublicAddress(privateKeyHex) {
  try {
    const privateKey = Buffer.from(privateKeyHex, 'hex');
    const publicKey = secp256k1.publicKeyCreate(privateKey, true);

    const sha256 = crypto.createHash('sha256').update(publicKey).digest();
    const ripemd160 = crypto.createHash('ripemd160').update(sha256).digest();

    const versionedHash = Buffer.concat([Buffer.from([0x00]), ripemd160]);

    const checksum = crypto.createHash('sha256')
      .update(crypto.createHash('sha256').update(versionedHash).digest())
      .digest()
      .slice(0, 4);

    const addressBytes = Buffer.concat([versionedHash, checksum]);

    return base58Encode(addressBytes);
  } catch (err) {
    return null;
  }
}

function base58Encode(buffer) {
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let encoded = '';
  let num = 0n;

  for (const byte of buffer) {
    num = (num << 8n) | BigInt(byte);
  }

  if (num === 0n) {
    encoded = alphabet[0];
  } else {
    while (num > 0n) {
      encoded = alphabet[Number(num % 58n)] + encoded;
      num = num / 58n;
    }
  }

  for (const byte of buffer) {
    if (byte === 0) {
      encoded = alphabet[0] + encoded;
    } else {
      break;
    }
  }

  return encoded;
}

function getWIF(privateKeyHex) {
  try {
    const privateKey = Buffer.from(privateKeyHex, 'hex');
    const versionedKey = Buffer.concat([Buffer.from([0x80]), privateKey, Buffer.from([0x01])]);

    const checksum = crypto.createHash('sha256')
      .update(crypto.createHash('sha256').update(versionedKey).digest())
      .digest()
      .slice(0, 4);

    const wifBytes = Buffer.concat([versionedKey, checksum]);
    return base58Encode(wifBytes);
  } catch (err) {
    return null;
  }
}

function searchRange(min, max, step) {
  const batchSize = 1000;
  let key = BigInt(min) + BigInt(workerIndex);
  const stepBig = BigInt(step || 1);
  const maxBig = BigInt(max);
  const matches = [];

  let lastReport = Date.now();
  let lastReportCount = 0;

  while (key < maxBig && !global.shouldStop) {
    const privateKeyHex = key.toString(16).padStart(64, '0');
    const address = getPublicAddress(privateKeyHex);

    if (address && walletsSet.has(address)) {
      const wif = getWIF(privateKeyHex);
      matches.push({
        privateKey: privateKeyHex,
        wif: wif,
        address: address
      });
      keysFound++;
    }

    keysChecked++;

    if (keysChecked % batchSize === 0) {
      const now = Date.now();
      const elapsed = (now - lastReport) / 1000;
      const keysPerSecond = (keysChecked - lastReportCount) / elapsed;

      parentPort.postMessage({
        type: 'progress',
        keysChecked,
        keysPerSecond,
        workerIndex,
        lastKey: privateKeyHex
      });

      lastReport = now;
      lastReportCount = keysChecked;
    }

    if (matches.length > 0) {
      parentPort.postMessage({
        type: 'match',
        matches: matches
      });
      matches.length = 0;
    }

    key += stepBig;
  }

  parentPort.postMessage({
    type: 'complete',
    keysChecked,
    keysFound,
    workerIndex
  });
}

parentPort.on('message', (msg) => {
  if (msg.type === 'start') {
    const { min, max, rand } = msg;
    const step = totalWorkers;
    searchRange(min, max, step);
  } else if (msg.type === 'stop') {
    global.shouldStop = true;
  }
});

parentPort.postMessage({ type: 'ready', workerIndex });
