/**
 * PM2 production process file (Phase 1).
 * Usage on EC2:
 *   cd ~/tpms/New-Town-Panchayat
 *   pm2 delete townpan 2>/dev/null; pm2 start ecosystem.config.cjs
 */
module.exports = {
  apps: [
    {
      name: 'townpan',
      script: 'server.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: '5000',
      },
      max_memory_restart: '1200M',
      listen_timeout: 120000,
      kill_timeout: 15000,
    },
  ],
};