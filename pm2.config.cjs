module.exports = {
  apps: [
    {
      name: 'cybervault-backend',
      script: 'server.js',
      instances: 1,
      exec_mode: 'cluster',
      max_memory_restart: '400M',

      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000,
        AWS_REGION: 'us-east-1',
      },
    },
  ],
};
