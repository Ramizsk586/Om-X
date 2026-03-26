async function main() {
  const serverId = String(process.argv[2] || '').trim().toLowerCase();
  if (!serverId) throw new Error('Missing MCP server id.');
  const transport = process.argv.includes('--stdio') ? 'stdio' : 'http';
  let serverOptions = {};
  try {
    serverOptions = process.env.MCP_SERVER_OPTIONS ? JSON.parse(process.env.MCP_SERVER_OPTIONS) : {};
  } catch (_) {
    serverOptions = {};
  }

  if (serverId === 'mcp') {
    const moduleRef = await import('../../mcp/server.mjs');
    await moduleRef.startServer({ ...serverOptions, transport });

    const shutdown = async () => {
      try {
        await moduleRef.stopServer();
      } catch (_) {}
      process.exit(0);
    };

    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
    return;
  }

  throw new Error(`Unknown MCP server id: ${serverId}`);
}

main().catch((error) => {
  const message = error && error.stack ? error.stack : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
