module.exports = {
  apps: [
    {
      name: 'cybervault-backend',
      script: 'server.js',
      instances: 1,
      autorestart: true,

      exec_mode: 'cluster',

      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
};
