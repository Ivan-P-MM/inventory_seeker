import { describe, it, expect } from 'vitest';
import { parseUrl } from './parseUrl';

describe('parseUrl', () => {
    it('should parse a standard domain', () => {
        const result = parseUrl('https://example.com/path');
        expect(result.root_domain).toBe('example.com');
        expect(result.subdomain).toBe(null);
        expect(result.path).toBe('/path');
        expect(result.display_path).toBe('example.com/path');
    });

    it('should handle subdomains', () => {
        const result = parseUrl('https://blog.example.com/art');
        expect(result.root_domain).toBe('example.com');
        expect(result.subdomain).toBe('blog');
        expect(result.path).toBe('/art');
        expect(result.display_path).toBe('blog.example.com/art');
    });

    it('should handle URLs without protocol', () => {
        const result = parseUrl('example.com');
        expect(result.root_domain).toBe('example.com');
        expect(result.display_path).toBe('example.com');
    });

    it('should return null for invalid URLs', () => {
        expect(parseUrl('')).toBe(null);
        expect(parseUrl('not-a-url')).toBe(null);
    });
});
