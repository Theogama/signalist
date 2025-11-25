/**
 * Type declaration for next/headers
 * Fixes TypeScript module resolution issue
 */

declare module 'next/headers' {
  export function headers(): Promise<Headers>;
  export function cookies(): {
    get: (name: string) => { name: string; value: string } | undefined;
    set: (name: string, value: string) => void;
    getAll: () => Array<{ name: string; value: string }>;
    has: (name: string) => boolean;
    delete: (name: string) => void;
  };
}

