# File Watching

CodeRAG provides real-time file watching using @parcel/watcher for automatic index updates when files change.

## @parcel/watcher Usage

@parcel/watcher is a native file watcher that uses platform-specific APIs for efficient change detection.

**Why @parcel/watcher?**

- Native performance (FSEvents on macOS, inotify on Linux, ReadDirectoryChangesW on Windows)
- Low CPU overhead (kernel-level notifications, not polling)
- Recursive directory watching
- Built-in ignore patterns
- Reliable event delivery

**Alternatives comparison:**

| Library | Performance | Reliability | Platform Support |
|---------|-------------|-------------|------------------|
| @parcel/watcher | Excellent (native) | High | macOS, Linux, Windows |
| chokidar | Good (fallback to polling) | Medium | All platforms |
| fs.watch | Poor (OS-dependent) | Low | Node.js built-in |

**Installation:**

```bash
npm install @parcel/watcher
```

@parcel/watcher is a native module with prebuilt binaries for major platforms.

## Debouncing (500ms)

File watchers emit events immediately, but multiple events often occur for a single logical change (e.g., save triggers multiple write events).

**Debouncing behavior:**

CodeRAG waits 500ms after the last event before processing changes. This consolidates rapid-fire events into a single update.

**Example without debouncing:**

```
User saves file
  ├─ 0ms: change event
  ├─ 5ms: change event
  ├─ 10ms: change event
  └─ 15ms: change event
Result: 4 index updates (wasteful)
```

**Example with debouncing (500ms):**

```
User saves file
  ├─ 0ms: change event → start timer
  ├─ 5ms: change event → reset timer
  ├─ 10ms: change event → reset timer
  └─ 15ms: change event → reset timer
  ... 500ms pass ...
  └─ 515ms: process update once
Result: 1 index update (efficient)
```

**Implementation:**

```typescript
private pendingUpdates = new Map<string, NodeJS.Timeout>()

private handleFileChange(type: 'add' | 'change' | 'unlink', absolutePath: string): void {
  const relativePath = path.relative(this.codebaseRoot, absolutePath)

  // Clear existing timeout
  const existing = this.pendingUpdates.get(relativePath)
  if (existing) {
    clearTimeout(existing)
  }

  // Set new timeout (500ms)
  const timeout = setTimeout(async () => {
    this.pendingUpdates.delete(relativePath)
    await this.processFileChange(type, relativePath, absolutePath)
  }, 500)

  this.pendingUpdates.set(relativePath, timeout)
}
```

**Debounce duration:**

500ms is chosen to balance responsiveness and efficiency:

- Too short (100ms): Multiple updates for single edit
- Too long (2000ms): Feels unresponsive
- 500ms: Good balance for typical edit workflows

## Incremental Updates

When files change, CodeRAG updates only affected chunks rather than rebuilding the entire index.

**Update algorithm:**

1. **Detect change**: File watcher emits event
2. **Debounce**: Wait 500ms for additional events
3. **Hash comparison**: Check if content actually changed
4. **Delete old chunks**: Remove chunks for changed file
5. **Re-chunk**: Parse file into new chunks
6. **Update vectors**: Compute TF-IDF vectors for new chunks
7. **Rebuild IDF**: Recalculate global IDF scores (affected by all changes)
8. **Recalculate TF-IDF**: Update TF-IDF scores using new IDF
9. **Update metadata**: Recalculate chunk magnitudes and average doc length

**Change detection flow:**

```typescript
async processFileChange(type: 'add' | 'change' | 'unlink', path: string) {
  if (type === 'unlink') {
    // File deleted
    await storage.deleteFile(path)
    await rebuildIndex()
    return
  }

  // File added or changed
  const content = await fs.readFile(absolutePath, 'utf-8')
  const newHash = simpleHash(content)

  // OPTIMIZATION: Compare hash to detect real changes
  const existingFile = await storage.getFile(path)
  if (existingFile && existingFile.hash === newHash) {
    console.log('File unchanged (same hash), skipping')
    return  // No actual change
  }

  // Content changed, update index
  const file: CodebaseFile = {
    path,
    content,
    hash: newHash,
    size: stats.size,
    mtime: stats.mtime,
    language: detectLanguage(path)
  }

  await storage.storeFile(file)
  await rebuildIndex()
}
```

**Hash-based optimization:**

File watcher events trigger on `mtime` changes, but content may be unchanged (e.g., file touched without edits). Hash comparison prevents unnecessary reindexing.

```typescript
// Simple hash function (fast, not cryptographic)
function simpleHash(content: string): string {
  let hash = 0
  for (let i = 0; i < content.length; i++) {
    hash = ((hash << 5) - hash + content.charCodeAt(i)) | 0
  }
  return hash.toString(36)
}
```

## Event Handling

@parcel/watcher emits events for file system changes. CodeRAG maps these to index operations.

**Event types:**

| Watcher Event | CodeRAG Type | Action |
|---------------|--------------|--------|
| `create` | `add` | Index new file |
| `update` | `change` | Re-index changed file |
| `delete` | `unlink` | Remove file from index |

**Subscription:**

```typescript
import * as watcher from '@parcel/watcher'

async startWatch(): Promise<void> {
  this.watcher = await watcher.subscribe(
    this.codebaseRoot,
    (err, events) => {
      if (err) {
        console.error('[WARN] File watcher error:', err.message)
        return
      }

      for (const event of events) {
        const absolutePath = event.path
        const relativePath = path.relative(this.codebaseRoot, absolutePath)

        // Skip ignored files
        if (this.shouldIgnore(relativePath)) {
          continue
        }

        // Map event type
        const eventType =
          event.type === 'create' ? 'add' :
          event.type === 'delete' ? 'unlink' :
          'change'

        this.handleFileChange(eventType, absolutePath)
      }
    },
    {
      // Auto-detect best backend (FSEvents, inotify, etc.)
      backend: undefined,

      // Ignore common directories
      ignore: [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**',
        '**/.next/**',
        '**/.turbo/**',
        '**/.cache/**',
        '**/coverage/**',
        '**/*.log',
      ]
    }
  )

  this.isWatching = true
  console.error('[SUCCESS] File watcher started (native FSEvents)')
}
```

**Event batching:**

@parcel/watcher batches events internally and delivers them in groups, reducing overhead.

```typescript
// Single callback receives all events in a batch
(err, events) => {
  // events = [
  //   { type: 'create', path: '/path/to/file1.ts' },
  //   { type: 'update', path: '/path/to/file2.ts' },
  //   { type: 'delete', path: '/path/to/file3.ts' }
  // ]
}
```

## Watch Lifecycle

**Starting watch mode:**

```typescript
import { CodebaseIndexer } from '@sylphx/coderag'

const indexer = new CodebaseIndexer({
  codebaseRoot: '/path/to/project',
  watch: true,  // Auto-start watching after indexing
  onFileChange: (event) => {
    console.log(`File ${event.type}: ${event.path}`)
  }
})

await indexer.index()
// Watcher automatically started after indexing completes

// Or start manually:
await indexer.startWatch()
```

**Stopping watch mode:**

```typescript
await indexer.stopWatch()
// Cleans up:
// - Unsubscribes from watcher
// - Clears pending update timers
// - Releases file handles
```

**Watch state:**

```typescript
const isWatching = indexer.isWatchEnabled()
// Returns: true if watching, false otherwise
```

## Ignore Patterns

CodeRAG respects .gitignore and custom ignore patterns.

**Gitignore support:**

```typescript
import { loadGitignore } from '@sylphx/coderag/utils'

const ignoreFilter = loadGitignore('/path/to/project')

// Check if file should be ignored
if (ignoreFilter.ignores('node_modules/package.json')) {
  console.log('File ignored')
}
```

Uses `ignore` library (same as git).

**Built-in ignore patterns:**

@parcel/watcher automatically ignores common directories:

```typescript
ignore: [
  '**/node_modules/**',  // Dependencies
  '**/.git/**',          // Git metadata
  '**/dist/**',          // Build output
  '**/build/**',         // Build output
  '**/.next/**',         // Next.js cache
  '**/.turbo/**',        // Turborepo cache
  '**/.cache/**',        // General cache
  '**/coverage/**',      // Test coverage
  '**/*.log',            // Log files
]
```

These are in addition to .gitignore patterns.

**Custom ignore filter:**

```typescript
private shouldIgnore(relativePath: string): boolean {
  // Skip empty paths
  if (!relativePath) return true

  // Check gitignore
  if (this.ignoreFilter?.ignores(relativePath)) {
    return true
  }

  // Custom rules
  if (relativePath.startsWith('.')) {
    return true  // Ignore hidden files
  }

  return false
}
```

## Performance Characteristics

**Event latency:**

| Platform | Native API | Latency | CPU Usage |
|----------|-----------|---------|-----------|
| macOS | FSEvents | 50-100ms | <1% |
| Linux | inotify | 10-50ms | <1% |
| Windows | ReadDirectoryChanges | 100-200ms | <2% |

**Overhead:**

- No polling (0% CPU when idle)
- Kernel-level notifications (efficient)
- Minimal memory footprint (~1-2MB)

**Scalability:**

@parcel/watcher handles large directory trees efficiently:

| Files | Memory | Event Rate |
|-------|--------|------------|
| 1k files | 1MB | 1000+ events/sec |
| 10k files | 2MB | 1000+ events/sec |
| 100k files | 5MB | 500+ events/sec |

## Example Usage

**Basic watching:**

```typescript
import { CodebaseIndexer } from '@sylphx/coderag'

const indexer = new CodebaseIndexer({
  codebaseRoot: './src',
  watch: true,
  onFileChange: (event) => {
    console.log(`[${event.type.toUpperCase()}] ${event.path} at ${new Date(event.timestamp).toISOString()}`)
  }
})

// Index and start watching
await indexer.index()

// Keep process alive
process.on('SIGINT', async () => {
  await indexer.stopWatch()
  process.exit(0)
})
```

**Manual watch control:**

```typescript
const indexer = new CodebaseIndexer({
  codebaseRoot: './src',
  watch: false  // Don't auto-start
})

await indexer.index()

// Start watching later
console.log('Starting file watcher...')
await indexer.startWatch()

// Perform searches...
const results = await indexer.search('async function')

// Stop when done
await indexer.stopWatch()
```

**File change callbacks:**

```typescript
const indexer = new CodebaseIndexer({
  watch: true,
  onFileChange: async (event) => {
    if (event.type === 'add') {
      console.log(`New file: ${event.path}`)
    } else if (event.type === 'change') {
      console.log(`Modified: ${event.path}`)
      // Notify external service
      await notifyWebhook({ type: 'file_changed', path: event.path })
    } else if (event.type === 'unlink') {
      console.log(`Deleted: ${event.path}`)
    }
  }
})
```

**Conditional watching:**

```typescript
// Only watch in development
const isDevelopment = process.env.NODE_ENV === 'development'

const indexer = new CodebaseIndexer({
  watch: isDevelopment,
  onFileChange: isDevelopment ? (event) => {
    console.log(`[DEV] File changed: ${event.path}`)
  } : undefined
})
```
