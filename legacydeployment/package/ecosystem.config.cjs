module.exports = {
  apps: [{
    name: 'scenario-backend',
    script: './dashboard/server/index.js',
    cwd: '/home/ubuntu/app',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PROJECT_ROOT: '/home/ubuntu/app',
      DATA_DIR: '/home/ubuntu/app/data',
      PORT: '3000'
    },
    env_file: '.env.production',
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    kill_timeout: 5000
  }]
};
