function ts(): string {
  return new Date().toISOString();
}

export function log(msg: string): void {
  process.stdout.write(`[${ts()}] ${msg}\n`);
}

export function logError(msg: string, err?: unknown): void {
  if (err === undefined) {
    process.stderr.write(`[${ts()}] ERROR ${msg}\n`);
    return;
  }
  const detail = err instanceof Error ? `${err.message}` : String(err);
  process.stderr.write(`[${ts()}] ERROR ${msg}: ${detail}\n`);
}
