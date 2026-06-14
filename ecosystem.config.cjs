// PM2 process definition for running AstroSocial in production.
//
//   pm2 start ecosystem.config.cjs --env production
//
// The app is a single Node.js/TypeScript process backed by SQLite. Because
// SQLite is a single-writer embedded database, run exactly ONE instance in
// `fork` mode — do NOT use PM2 `cluster` mode / multiple instances, as several
// processes writing the same database file would contend for the write lock.
module.exports = {
  apps: [
    {
      name: 'astrosocial',
      // Run the TypeScript entrypoint directly through the tsx loader
      // (no build step required), matching `npm start`.
      script: 'src/server.ts',
      interpreter: 'node',
      interpreter_args: '--import tsx',

      instances: 1,
      exec_mode: 'fork',

      // Restart the process if it exceeds this memory ceiling.
      max_memory_restart: '512M',

      // Restart on crash, but back off if it keeps failing immediately.
      autorestart: true,
      min_uptime: '10s',
      max_restarts: 10,

      // Logs (PM2 also keeps its own rotated copies under ~/.pm2/logs).
      out_file: './data/logs/astrosocial.out.log',
      error_file: './data/logs/astrosocial.err.log',
      merge_logs: true,
      time: true,

      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
  ],
};
