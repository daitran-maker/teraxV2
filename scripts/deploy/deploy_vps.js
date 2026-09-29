const { Client } = require('ssh2');
const fs = require('fs');

const conn = new Client();
conn.on('ready', () => {
  console.log('SSH connection established successfully!');
  // 1. Upload file using SFTP
  conn.sftp((err, sftp) => {
    if (err) {
      console.error('SFTP error:', err);
      conn.end();
      return;
    }
    console.log('SFTP session started. Uploading CRC_App_Docker_Ready.tar.gz to server...');
    sftp.fastPut('CRC_App_Docker_Ready.tar.gz', 'CRC_App_Docker_Ready.tar.gz', {}, (uploadErr) => {
      if (uploadErr) {
        console.error('Upload error:', uploadErr);
        conn.end();
        return;
      }
      console.log('Package TAR file uploaded successfully! Running deployment commands on remote host...');
      
      // 2. Run remote commands
      const remoteCmd = 'mkdir -p ~/crc_app && tar -xzvf ~/CRC_App_Docker_Ready.tar.gz -C ~/crc_app ; cd ~/crc_app && echo "Lee@122598" | sudo -S docker compose -f docker-compose.standalone.yml up -d --build';
      conn.exec(remoteCmd, (execErr, stream) => {
        if (execErr) {
          console.error('Exec error:', execErr);
          conn.end();
          return;
        }
        stream.on('close', (code, signal) => {
          console.log(`Remote deployment command completed with exit code ${code}`);
          conn.end();
        }).on('data', (data) => {
          console.log('STDOUT: ' + data);
        }).stderr.on('data', (data) => {
          console.log('STDERR: ' + data);
        });
      });
    });
  });
});

const path = require('path');
const os = require('os');

conn.on('keyboard-interactive', (name, instructions, instructionsLang, prompts, finish) => {
  finish(['Lee@122598']);
});

let privateKey;
try {
  const keyPath = path.join(os.homedir(), '.ssh', 'id_ed25519');
  if (fs.existsSync(keyPath)) {
    privateKey = fs.readFileSync(keyPath);
    console.log('Loaded local SSH private key: ' + keyPath);
  }
} catch (err) {
  console.log('No local SSH key loaded, falling back to password/keyboard-interactive...');
}

conn.connect({
  host: '100.70.140.42',
  port: 8991,
  username: 'alui98hp',
  password: 'Lee@122598',
  privateKey: privateKey,
  tryKeyboardInteractive: true,
  readyTimeout: 30000
});
