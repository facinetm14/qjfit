import pino from 'pino';

const CODE_FRAME_LINE = /^→?\s*\d+\b/;

function cleanMessage(message: string): string {
  return message
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !CODE_FRAME_LINE.test(line))
    .join(' ');
}

function cleanStack(stack: string | undefined): string | undefined {
  if (!stack) {
    return stack;
  }
  const callSites = stack.split('\n').filter((line) => line.trim().startsWith('at '));
  return callSites.length > 0 ? callSites.join('\n') : stack;
}

export function serializeError(error: unknown): Record<string, unknown> {
  if (!(error instanceof Error)) {
    return { message: String(error) };
  }
  const serialized = pino.stdSerializers.err(error);
  return {
    ...serialized,
    message: cleanMessage(serialized.message),
    stack: cleanStack(serialized.stack),
  };
}

export function createLogger() {
  return pino({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    base: { service: 'qjfit-api' },
    serializers: { err: serializeError },
  });
}
