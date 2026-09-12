import { execFileSync } from 'node:child_process'

const ports = ['39889', '39890', '5173', '5174']

function pidsForPort(port) {
  try {
    const out = execFileSync('lsof', ['-ti', `tcp:${port}`], { encoding: 'utf8' })
    return out
      .split('\n')
      .map((p) => p.trim())
      .filter(Boolean)
  } catch {
    return []
  }
}

const pids = [...new Set(ports.flatMap(pidsForPort))]

if (!pids.length) {
  console.log('No CPD tracker dev processes found on the CPD tracker development ports.')
  process.exit(0)
}

for (const pid of pids) {
  try {
    process.kill(Number(pid), 'SIGTERM')
    console.log(`Stopped process ${pid}`)
  } catch (err) {
    console.log(`Could not stop process ${pid}: ${err.message}`)
  }
}
