import { describe, it, expect } from 'vitest';
import { parseAdsTxt, hasDV360Entry } from './parseAdsTxt';

describe('parseAdsTxt', () => {
    it('should parse valid entries', () => {
        const content = 'google.com, pub-12345, DIRECT, tag-id';
        const { entries } = parseAdsTxt(content);
        expect(entries).toHaveLength(1);
        expect(entries[0]).toEqual({
            domain: 'google.com',
            publisherId: 'pub-12345',
            relationship: 'DIRECT',
            certId: 'tag-id'
        });
    });

    it('should ignore comments and empty lines', () => {
        const content = '# Comment\n\ngoogle.com, pub-123, DIRECT';
        const { entries } = parseAdsTxt(content);
        expect(entries).toHaveLength(1);
    });

    it('should be case-insensitive for domain and relationship', () => {
        const content = 'GOOGLE.COM, pub-123, direct';
        const { entries } = parseAdsTxt(content);
        expect(entries[0].domain).toBe('google.com');
        expect(entries[0].relationship).toBe('DIRECT');
    });
});

describe('hasDV360Entry', () => {
    it('should return true if google.com DIRECT exists', () => {
        const content = 'google.com, pub-1, DIRECT';
        expect(hasDV360Entry(content)).toBe(true);
    });

    it('should return true if google.com RESELLER exists', () => {
        const content = 'google.com, pub-1, RESELLER';
        expect(hasDV360Entry(content)).toBe(true);
    });

    it('should return false if google.com entry is missing', () => {
        const content = 'other.com, pub-1, DIRECT';
        expect(hasDV360Entry(content)).toBe(false);
    });
});
