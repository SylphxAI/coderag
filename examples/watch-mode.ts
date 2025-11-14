/**
 * File watching example - automatic index updates
 * Run with: bun run examples/watch-mode.ts
 */

import { CodebaseIndexer } from '@sylphx/codebase-search';

async function main() {
  console.log('🔍 Codebase Search - Watch Mode Example\n');

  // Create indexer with file watching
  const indexer = new CodebaseIndexer({
    codebaseRoot: process.cwd(),
    maxFileSize: 1048576, // 1MB
    onFileChange: (event) => {
      console.log(`\n📝 File ${event.type}: ${event.path}`);
      console.log(`   Timestamp: ${new Date(event.timestamp).toLocaleTimeString()}`);
    },
  });

  console.log('📚 Indexing codebase with watch mode...\n');

  // Index with watch enabled
  await indexer.index({
    watch: true, // Enable file watching
    onProgress: (current, total, file) => {
      if (current % 10 === 0 || current === total) {
        console.log(`  ${current}/${total} files indexed`);
      }
    },
  });

  const indexedCount = await indexer.getIndexedCount();
  console.log(`\n✓ Indexed ${indexedCount} files`);
  console.log('👁️  Watching for file changes...\n');
  console.log('💡 Try modifying, adding, or deleting files in this directory.');
  console.log('   The index will automatically update.\n');
  console.log('Press Ctrl+C to stop watching.\n');

  // Example search every 5 seconds
  setInterval(async () => {
    try {
      const results = await indexer.search('CodebaseIndexer', { limit: 3 });
      console.log(`\n🔎 Latest search results (${results.length} found):`);
      for (const result of results) {
        console.log(`  - ${result.path} (score: ${result.score.toFixed(4)})`);
      }
    } catch (error) {
      console.error('Search error:', error);
    }
  }, 5000);

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n\n🛑 Stopping file watcher...');
    await indexer.stopWatch();
    console.log('✓ Stopped\n');
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
