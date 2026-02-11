import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDemoAwareNavigate, preserveDemoParam } from './navigation';

const env = import.meta.env as Record<string, string | boolean | undefined>;
const originalMode = env.MODE;
const originalDev = env.DEV;
const originalProd = env.PROD;

describe('navigation demo param handling', () => {
  beforeEach(() => {
    env.MODE = originalMode;
    env.DEV = originalDev;
    env.PROD = originalProd;
  });

  it('preserves demo=true in non-production runtime', () => {
    env.MODE = 'test';
    env.DEV = true;
    env.PROD = false;

    expect(preserveDemoParam('/accounts', '?demo=true')).toBe('/accounts?demo=true');
    expect(preserveDemoParam('/accounts?tab=all', '?demo=true')).toBe('/accounts?tab=all&demo=true');
  });

  it('does not append demo=true when query does not contain demo mode', () => {
    env.MODE = 'test';
    env.DEV = true;
    env.PROD = false;

    expect(preserveDemoParam('/accounts', '?foo=bar')).toBe('/accounts');
  });

  it('does not preserve demo=true in production runtime', () => {
    env.MODE = 'production';
    env.DEV = false;
    env.PROD = true;

    expect(preserveDemoParam('/accounts', '?demo=true')).toBe('/accounts');
    expect(preserveDemoParam('/accounts?tab=all', '?demo=true')).toBe('/accounts?tab=all');
  });

  it('createDemoAwareNavigate uses preserveDemoParam behavior', () => {
    env.MODE = 'test';
    env.DEV = true;
    env.PROD = false;

    const navigate = vi.fn();
    const wrappedNavigate = createDemoAwareNavigate(navigate, '?demo=true');
    wrappedNavigate('/settings/data');

    expect(navigate).toHaveBeenCalledWith('/settings/data?demo=true');
  });
});
