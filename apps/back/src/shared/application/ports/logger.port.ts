export interface LoggerPort {
  error(context: Record<string, unknown>, message: string): void;
}
