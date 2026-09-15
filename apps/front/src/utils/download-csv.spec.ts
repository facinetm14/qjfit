import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadCsv } from './download-csv.js';

describe('downloadCsv', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('builds a CSV blob URL, triggers a download link click, then revokes the URL', () => {
    const createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });

    const click = vi.fn();
    const link = { href: '', download: '', click } as unknown as HTMLAnchorElement;
    const createElement = vi.fn().mockReturnValue(link);
    vi.stubGlobal('document', { createElement });

    downloadCsv('a,b\r\n1,2', 'qjfit-matches.csv');

    expect(createElement).toHaveBeenCalledWith('a');
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(link.href).toBe('blob:mock-url');
    expect(link.download).toBe('qjfit-matches.csv');
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });
});
