const https = require('https');
const crypto = require('crypto');

class TurnstileService {
    constructor() {
        this.secretKey = process.env.TURNSTILE_SECRET_KEY;
        this.verifyUrl = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
        this.timeout = 10000; // 10 second timeout as recommended
        
        if (!this.secretKey) {
            console.warn('⚠️ TURNSTILE_SECRET_KEY not found in environment variables');
        }
    }

    /**
     * Verify a Turnstile token with retry logic
     * @param {string} token - The Turnstile token from the frontend
     * @param {string} remoteip - The user's IP address (optional)
     * @param {number} maxRetries - Maximum number of retry attempts
     * @returns {Promise<Object>} Verification result
     */
    async verifyToken(token, remoteip = null, maxRetries = 3) {
        if (!this.secretKey) {
            return {
                success: false,
                error: 'Turnstile secret key not configured',
                errorCodes: ['missing-input-secret']
            };
        }

        if (!token) {
            return {
                success: false,
                error: 'No token provided',
                errorCodes: ['missing-input-response']
            };
        }

        // Validate token length (max 2048 characters as per documentation)
        if (token.length > 2048) {
            return {
                success: false,
                error: 'Token too long',
                errorCodes: ['invalid-input-response']
            };
        }

        const idempotencyKey = crypto.randomUUID();

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const postData = new URLSearchParams({
                    secret: this.secretKey,
                    response: token,
                    idempotency_key: idempotencyKey
                });

                // Add IP address if provided
                if (remoteip) {
                    postData.append('remoteip', remoteip);
                }

                const response = await this.makeRequest(postData.toString());
                
                console.log(`Turnstile API response (attempt ${attempt}):`, response);

                const result = {
                    success: response.success || false,
                    challengeTs: response['challenge_ts'],
                    hostname: response.hostname,
                    errorCodes: response['error-codes'] || [],
                    action: response.action,
                    cdata: response.cdata,
                    error: response.success ? null : this.getErrorFromCodes(response['error-codes'])
                };

                // If successful or this is the last attempt, return the result
                if (response.success || attempt === maxRetries) {
                    return result;
                }

                // Wait before retrying (exponential backoff)
                if (attempt < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
                }

            } catch (error) {
                console.error(`Turnstile verification error (attempt ${attempt}):`, error);
                
                // If this is the last attempt, return error
                if (attempt === maxRetries) {
                    return {
                        success: false,
                        error: 'Turnstile verification failed due to network error',
                        errorCodes: ['internal-error']
                    };
                }

                // Wait before retrying
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
            }
        }
    }

    /**
     * Make HTTP request to Turnstile API with timeout
     * @param {string} postData - URL encoded post data
     * @returns {Promise<Object>} API response
     */
    makeRequest(postData) {
        return new Promise((resolve, reject) => {
            const options = {
                hostname: 'challenges.cloudflare.com',
                port: 443,
                path: '/turnstile/v0/siteverify',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Content-Length': Buffer.byteLength(postData),
                    'User-Agent': 'OrdiBird-TurnstileService/1.0'
                },
                timeout: this.timeout
            };

            const req = https.request(options, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    try {
                        const response = JSON.parse(data);
                        resolve(response);
                    } catch (error) {
                        reject(new Error('Invalid JSON response from Turnstile API'));
                    }
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });

            req.write(postData);
            req.end();
        });
    }

    /**
     * Check if the verification result indicates a human user
     * @param {Object} result - Result from verifyToken
     * @returns {boolean} True if human, false if bot or error
     */
    isHuman(result) {
        return result.success === true;
    }

    /**
     * Get user-friendly error message from verification result
     * @param {Object} result - Result from verifyToken
     * @returns {string} User-friendly error message
     */
    getErrorMessage(result) {
        if (result.success) {
            return 'Verification successful';
        }

        if (result.error) {
            return result.error;
        }

        return 'Security verification failed. Please try again.';
    }

    /**
     * Convert Turnstile error codes to readable error message
     * @param {Array} errorCodes - Array of error codes from Turnstile
     * @returns {string} Human readable error message
     */
    getErrorFromCodes(errorCodes) {
        if (!errorCodes || errorCodes.length === 0) {
            return 'Unknown verification error';
        }

        const errorMap = {
            'missing-input-secret': 'The secret parameter is missing',
            'invalid-input-secret': 'The secret parameter is invalid or malformed',
            'missing-input-response': 'The response parameter is missing',
            'invalid-input-response': 'The response parameter is invalid or malformed',
            'bad-request': 'The request is invalid or malformed',
            'timeout-or-duplicate': 'The response is no longer valid: either is too old or has been used previously',
            'internal-error': 'An internal error happened while validating the response. The request can be retried'
        };

        const firstError = errorCodes[0];
        return errorMap[firstError] || `Verification failed with error: ${firstError}`;
    }

    /**
     * Get statistics about Turnstile usage (placeholder for future implementation)
     * @returns {Object} Usage statistics
     */
    getStats() {
        return {
            service: 'Cloudflare Turnstile',
            configured: !!this.secretKey,
            endpoint: this.verifyUrl
        };
    }
}

module.exports = TurnstileService;
