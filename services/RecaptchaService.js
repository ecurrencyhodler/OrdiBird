class RecaptchaService {
    constructor() {
        this.secretKey = process.env.RECAPTCHA_SECRET_KEY;
        this.verifyUrl = 'https://www.google.com/recaptcha/api/siteverify';
        this.scoreThreshold = 0.5; // Minimum score to consider human (0.0 = bot, 1.0 = human)
    }

    /**
     * Verify reCAPTCHA token with Google's API
     * @param {string} token - reCAPTCHA token from frontend
     * @param {string} remoteip - User's IP address (optional)
     * @returns {Promise<Object>} Verification result
     */
    async verifyToken(token, remoteip = null) {
        try {
            if (!token) {
                return {
                    success: false,
                    error: 'No reCAPTCHA token provided',
                    score: 0
                };
            }

            if (!this.secretKey) {
                console.error('❌ RECAPTCHA_SECRET_KEY not configured');
                return {
                    success: false,
                    error: 'reCAPTCHA not properly configured',
                    score: 0
                };
            }

            // Prepare request body
            const params = new URLSearchParams({
                secret: this.secretKey,
                response: token
            });

            if (remoteip) {
                params.append('remoteip', remoteip);
            }

            console.log('🔍 Verifying reCAPTCHA token...');

            // Make request to Google's verification API
            const response = await fetch(this.verifyUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: params
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            console.log('📊 reCAPTCHA verification result:', {
                success: result.success,
                score: result.score,
                action: result.action,
                hostname: result.hostname
            });

            // Check if verification was successful
            if (!result.success) {
                return {
                    success: false,
                    error: 'reCAPTCHA verification failed',
                    errorCodes: result['error-codes'] || [],
                    score: result.score || 0
                };
            }

            // Check score threshold for v3
            if (result.score !== undefined && result.score < this.scoreThreshold) {
                return {
                    success: false,
                    error: `reCAPTCHA score too low (${result.score}). Possible bot activity detected.`,
                    score: result.score,
                    belowThreshold: true
                };
            }

            return {
                success: true,
                score: result.score || 1.0,
                action: result.action,
                hostname: result.hostname,
                challenge_ts: result.challenge_ts
            };

        } catch (error) {
            console.error('❌ reCAPTCHA verification error:', error);
            return {
                success: false,
                error: 'Failed to verify reCAPTCHA: ' + error.message,
                score: 0
            };
        }
    }

    /**
     * Check if a verification result indicates a human user
     * @param {Object} verificationResult - Result from verifyToken()
     * @returns {boolean} True if user appears to be human
     */
    isHuman(verificationResult) {
        return verificationResult.success && 
               verificationResult.score >= this.scoreThreshold;
    }

    /**
     * Get human-readable error message for frontend
     * @param {Object} verificationResult - Result from verifyToken()
     * @returns {string} User-friendly error message
     */
    getErrorMessage(verificationResult) {
        if (verificationResult.belowThreshold) {
            return 'Security verification failed. Please try again or contact support if this persists.';
        }

        if (verificationResult.errorCodes && verificationResult.errorCodes.length > 0) {
            const errorCode = verificationResult.errorCodes[0];
            switch (errorCode) {
                case 'missing-input-secret':
                case 'invalid-input-secret':
                    return 'Server configuration error. Please contact support.';
                case 'missing-input-response':
                case 'invalid-input-response':
                    return 'Security verification failed. Please refresh the page and try again.';
                case 'bad-request':
                    return 'Invalid request. Please refresh the page and try again.';
                case 'timeout-or-duplicate':
                    return 'Security verification expired. Please try again.';
                default:
                    return 'Security verification failed. Please try again.';
            }
        }

        return 'Security verification failed. Please try again.';
    }

    /**
     * Set custom score threshold
     * @param {number} threshold - Score threshold (0.0 to 1.0)
     */
    setScoreThreshold(threshold) {
        if (threshold >= 0 && threshold <= 1) {
            this.scoreThreshold = threshold;
            console.log(`🎯 reCAPTCHA score threshold set to: ${threshold}`);
        } else {
            console.warn('⚠️ Invalid score threshold. Must be between 0.0 and 1.0');
        }
    }

    /**
     * Get current configuration info
     * @returns {Object} Configuration details
     */
    getConfig() {
        return {
            configured: !!this.secretKey,
            scoreThreshold: this.scoreThreshold,
            verifyUrl: this.verifyUrl
        };
    }
}

module.exports = RecaptchaService;
