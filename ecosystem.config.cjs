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
      // Run the TypeScript entrypoint through the tsx CLI (no build step),
      // matching `npm start`. We invoke tsx's CLI as the script rather than
      // passing `--import tsx` via node_args: in PM2 `fork` mode the loader
      // flags are NOT reliably forwarded to the worker, which makes node load
      // server.ts raw and fail with ERR_UNKNOWN_FILE_EXTENSION. Running the
      // tsx CLI directly avoids that. (Requires tsx to be a runtime
      // dependency — it is listed under "dependencies" in package.json.)
      script: './node_modules/tsx/dist/cli.mjs',
      args: 'src/server.ts',
      interpreter: 'node',

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
