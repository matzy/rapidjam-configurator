if (!process.env.PORT) {
  process.env.PORT = '5175'
}

await import('../server.mjs')
