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
        PORT: '5000',
        DB_HOST: 'cybervault.c0pwoak44mbr.us-east-1.rds.amazonaws.com',
        DB_PORT: '3306',
        DB_NAME: 'cybervault',
        DB_USER: 'admin',
        DB_PASSWORD: 'Bankdb_22',
        DB_NAME_TEST: 'bank_test',
        JWT_SECRET: '5b61b6de0e7c9f68f8f3647ac758e26bede63773554b39bcc0137ae417eda5d9',
        JWT_REFRESH_SECRET: 'a2409a82f0d0142af01860333d86d9a7122d69d2f9013f34f82a86a043849951',
        JWT_ACCESS_EXPIRES_IN: '10m',
        JWT_REFRESH_EXPIRES_IN: '30d',
        ENCRYPTION_KEY: 'bd864a34543e3d9a42409a7943d3854c7803663eafd7ff9a88a216756b89d58c',
        CORS_ORIGINS: 'http://localhost:3000,http://localhost:5000',
        LOG_LEVEL: 'info',
        EMAIL_USER: 'mbadwy480@gmail.com',
        EMAIL_PASS: '',
        EMAIL_SERVICE: 'Gmail',
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000,
        AWS_REGION: 'us-east-1',
      },
    },
  ],
};





