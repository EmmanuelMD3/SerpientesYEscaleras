import { execFile } from 'node:child_process';
import net from 'node:net';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const ports = [3000, 5173];

function checkPort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', (error) => {
      resolve({
        port,
        available: false,
        code: error.code,
      });
    });

    server.once('listening', () => {
      server.close(() => {
        resolve({
          port,
          available: true,
        });
      });
    });

    server.listen(port, '127.0.0.1');
  });
}

async function findWindowsPids(port) {
  if (process.platform !== 'win32') {
    return [];
  }

  const command = [
    `Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue`,
    'Select-Object -ExpandProperty OwningProcess',
  ].join(' | ');

  try {
    const { stdout } = await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-Command', command],
      {
        windowsHide: true,
      },
    );

    return Array.from(
      new Set(
        stdout
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean),
      ),
    );
  } catch {
    return [];
  }
}

let hasBusyPorts = false;

for (const port of ports) {
  const result = await checkPort(port);

  if (result.available) {
    console.log(`[ports] ${port}: available`);
    continue;
  }

  hasBusyPorts = true;
  const pids = await findWindowsPids(port);
  const owner = pids.length > 0 ? ` by PID(s): ${pids.join(', ')}` : '';
  console.log(`[ports] ${port}: in use${owner}`);
}

if (hasBusyPorts && process.platform === 'win32') {
  console.log('[ports] To inspect a Windows process: Get-Process -Id <PID>');
  console.log(
    '[ports] To list listeners: Get-NetTCPConnection -LocalPort 3000,5173 -State Listen',
  );
}
