let shuttingDown = false;

export function isProcessShuttingDown(): boolean {
  return shuttingDown;
}

export function beginShutdown(): void {
  shuttingDown = true;
}

export function resetLifecycleForTests(): void {
  shuttingDown = false;
}
