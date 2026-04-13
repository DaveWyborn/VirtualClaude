module.exports = {
  apps: [{
    name: 'claude-workspace-api',
    script: 'index.js',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    }
  }]
};
