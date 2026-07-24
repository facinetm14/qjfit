import { serializeError } from './logger.js';

describe('serializeError', () => {
  it('collapses a Prisma-style code-frame message into a single readable line ending in the root cause', () => {
    const error = new Error(
      [
        '',
        'Invalid `this.prisma.fetchRun.create()` invocation in',
        '/app/src/infrastructure/adapters/output/repositories/prisma-fetch-runs.repository.ts:12:33',
        '',
        '   9 constructor(@inject(TYPES.PrismaClient) private readonly prisma: PrismaClient) {}',
        '  10 ',
        '  11 async createPending(): Promise<FetchRun> {',
        '→ 12   return this.prisma.fetchRun.create(',
        'Can\'t reach database server at `db:5432`.',
        '',
        'Please make sure your database server is running at `db:5432`.',
      ].join('\n'),
    );
    error.name = 'PrismaClientInitializationError';

    const result = serializeError(error);

    expect(result.message).not.toContain('\n');
    expect(result.message).not.toMatch(/\d+\s+constructor/);
    expect(result.message).toContain("Can't reach database server at `db:5432`.");
    expect(result.message).toContain('Please make sure your database server is running at `db:5432`.');
  });

  it('strips the duplicated message body out of the stack, keeping only call sites', () => {
    const error = new Error('boom\nwith a second line of detail');

    const result = serializeError(error);

    expect(result.stack).not.toContain('with a second line of detail');
    expect(String(result.stack)).toMatch(/^\s*at /);
  });

  it('passes through a plain single-line error message unchanged', () => {
    const error = new Error('lifecycle boom');

    const result = serializeError(error);

    expect(result.message).toBe('lifecycle boom');
  });

  it('handles non-Error values without throwing', () => {
    const result = serializeError('just a string');

    expect(result.message).toBe('just a string');
  });
});
