import { writeFile, rename, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';

/**
 * Atomically write content to a file (write to temp, then rename).
 * This prevents partial writes from corrupting the file.
 */
export async function atomicWriteFile(filePath: string, content: string): Promise<void> {
  const dir = dirname(filePath);
  const tempPath = join(dir, `.tmp-${randomUUID()}`);

  try {
    await writeFile(tempPath, content);
    await rename(tempPath, filePath);
  } catch (err) {
    // Clean up temp file if rename failed
    try {
      await unlink(tempPath);
    } catch {
      // Ignore cleanup errors
    }
    throw err;
  }
}
