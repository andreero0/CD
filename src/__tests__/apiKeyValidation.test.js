/**
 * Tests for API key validation logic
 */

describe('API Key Validation', () => {
    // Mock validateApiKeyFormat function (extracted from OnboardingView)
    function validateApiKeyFormat(key) {
        // Gemini API keys typically start with "AIza" and are 39 characters long
        // Format: AIza[35 alphanumeric characters, hyphens, or underscores]
        if (!key || key.trim() === '') {
            return { valid: false, error: 'API key is required' };
        }

        const trimmedKey = key.trim();

        // Check if it starts with AIza
        if (!trimmedKey.startsWith('AIza')) {
            return { valid: false, error: 'Invalid API key format. Gemini keys start with "AIza"' };
        }

        // Check length (should be 39 characters)
        if (trimmedKey.length !== 39) {
            return { valid: false, error: `Invalid API key length. Expected 39 characters, got ${trimmedKey.length}` };
        }

        // Check for valid characters (alphanumeric, hyphens, underscores)
        const validChars = /^AIza[A-Za-z0-9_-]{35}$/;
        if (!validChars.test(trimmedKey)) {
            return { valid: false, error: 'API key contains invalid characters' };
        }

        return { valid: true };
    }

    test('should reject empty API key', () => {
        const result = validateApiKeyFormat('');
        expect(result.valid).toBe(false);
        expect(result.error).toBe('API key is required');
    });

    test('should reject null/undefined API key', () => {
        const result = validateApiKeyFormat(null);
        expect(result.valid).toBe(false);
        expect(result.error).toBe('API key is required');
    });

    test('should reject API key without AIza prefix', () => {
        const result = validateApiKeyFormat('InvalidKey12345678901234567890123456789');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('AIza');
    });

    test('should reject API key with wrong length (too short)', () => {
        const result = validateApiKeyFormat('AIzaShortKey');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('length');
    });

    test('should reject API key with wrong length (too long)', () => {
        const result = validateApiKeyFormat('AIza' + 'a'.repeat(40));
        expect(result.valid).toBe(false);
        expect(result.error).toContain('length');
    });

    test('should reject API key with invalid characters', () => {
        const result = validateApiKeyFormat('AIza' + 'a'.repeat(33) + '!@');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('invalid characters');
    });

    test('should accept valid API key format', () => {
        const validKey = 'AIza' + 'A'.repeat(35);
        const result = validateApiKeyFormat(validKey);
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
    });

    test('should accept valid API key with hyphens and underscores', () => {
        const validKey = 'AIza' + 'A-B_C'.repeat(7);
        const result = validateApiKeyFormat(validKey);
        expect(result.valid).toBe(true);
    });

    test('should trim whitespace from API key', () => {
        const validKey = '  AIza' + 'A'.repeat(35) + '  ';
        const result = validateApiKeyFormat(validKey);
        expect(result.valid).toBe(true);
    });
});
