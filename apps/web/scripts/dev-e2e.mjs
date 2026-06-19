import { spawn } from 'child_process'

const dev = spawn('node_modules/.bin/next', ['dev', '--port', '3001'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'test',
    NODE_OPTIONS: '--dns-result-order=ipv4first',
  },
  shell: false,
})

dev.on('exit', (code) => process.exit(code ?? 0))
process.on('SIGINT', () => dev.kill('SIGINT'))
process.on('SIGTERM', () => dev.kill('SIGTERM'))
