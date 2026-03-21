async function main() {
  const serverId = String(process.argv[2] || '').trim().toLowerCase();
  if (!serverId) throw new Error('Missing MCP server id.');

  if (serverId === 'mcp') {
    await import('../../mcp/server.mjs');
    return;
  }

  throw new Error(`Unknown MCP server id: ${serverId}`);
}

main().catch((error) => {
  const message = error && error.stack ? error.stack : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
