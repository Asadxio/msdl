const { spawn } = require('child_process');

const eas = spawn('C:\\\\Program Files\\\\nodejs\\\\npx.cmd', ['eas', 'login', '--no-browser'], {
  cwd: 'C:\\\\Users\\\\xioas\\\\.gemini\\\\antigravity\\\\scratch\\\\msdl\\\\frontend',
  shell: false
});

eas.stdout.on('data', (data) => {
  const output = data.toString();
  console.log('STDOUT:', output);
  if (output.includes('Email or username')) {
    setTimeout(() => eas.stdin.write('shahmullaalam@gmail.com\\n'), 500);
  }
  if (output.includes('Password')) {
    setTimeout(() => eas.stdin.write('sumra@1Sumra\\n'), 500);
  }
});

eas.stderr.on('data', (data) => {
  const output = data.toString();
  console.error('STDERR:', output);
});

eas.on('close', (code) => {
  console.log('child process exited with code ' + code);
  process.exit(code);
});
