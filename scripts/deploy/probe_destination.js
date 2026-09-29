const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const cmd = `
    echo "=== 1. Kubernetes Nodes ==="
    echo "welcome1" | sudo -S kubectl get nodes -o wide || true

    echo "\n=== 2. Kubernetes Pods in all namespaces ==="
    echo "welcome1" | sudo -S kubectl get pods -A || true

    echo "\n=== 3. Kubernetes Services in all namespaces ==="
    echo "welcome1" | sudo -S kubectl get svc -A || true
  `;
  conn.exec(cmd, (err, stream) => {
    stream.on('close', () => conn.end())
      .on('data', (data) => process.stdout.write(data.toString()))
      .stderr.on('data', (data) => process.stderr.write(data.toString()));
  });
});
conn.connect({
  host: '10.91.1.51',
  port: 22,
  username: 'terax',
  password: 'welcome1',
  tryKeyboardInteractive: true,
  readyTimeout: 30000
});
