import { CommanderError } from 'commander';
import { ApiError } from './endpoint.ts';

// Entry-point wrapper: short messages instead of stack traces, exit code 1 on failure.
export function runMain(main: () => Promise<void>): void {
  main().catch((error: unknown) => {
    // Commander already printed its own message (or the help text).
    if (error instanceof CommanderError) {
      process.exitCode = error.exitCode;
      return;
    }
    console.error(error instanceof Error ? error.message : String(error));
    if (error instanceof ApiError) console.error(JSON.stringify(error.response, null, 2));
    process.exitCode = 1;
  });
}
