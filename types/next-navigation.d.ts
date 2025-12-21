/**
 * Type declaration for next/navigation
 * Fixes TypeScript module resolution issue
 */

declare module 'next/navigation' {
  export function redirect(url: string): never;
  export function notFound(): never;
  export function useRouter(): {
    push: (url: string) => void;
    replace: (url: string) => void;
    refresh: () => void;
    back: () => void;
    forward: () => void;
    prefetch: (url: string) => void;
  };
  export function usePathname(): string;
  export function useSearchParams(): Readonly<URLSearchParams>;
}









