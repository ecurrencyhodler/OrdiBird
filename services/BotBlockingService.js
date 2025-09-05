class BotBlockingService {
    constructor() {
        // Track requests per IP address with timestamps
        this.ipRequestTracker = new Map(); // key: IP, value: { requests: [], blocked: false, blockedUntil: null }
        this.suspiciousIPs = new Set(); // IPs that have been flagged as suspicious
        this.blockedIPs = new Set(); // IPs that are currently blocked
        
        // Configuration - configurable via environment variables
        this.MAX_REQUESTS_PER_WINDOW = parseInt(process.env.BOT_BLOCKING_MAX_REQUESTS) || 10; // Max requests allowed
        this.TIME_WINDOW_MS = (parseInt(process.env.BOT_BLOCKING_TIME_WINDOW_SECONDS) || 10) * 1000; // Time window in seconds
        this.BLOCK_DURATION_MS = (parseInt(process.env.BOT_BLOCKING_DURATION_HOURS) || 12) * 60 * 60 * 1000; // Block duration in hours
        this.CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // Clean up old data every 5 minutes
        
        // Bot detection patterns
        this.BOT_USER_AGENTS = [
            /bot/i,
            /crawler/i,
            /spider/i,
            /scraper/i,
            /curl/i,
            /wget/i,
            /python-requests/i,
            /node-fetch/i,
            /axios/i,
            /postman/i
        ];
        
        // Start cleanup interval
        this.startCleanupInterval();
        
        console.log('🛡️ BotBlockingService initialized');
        console.log(`📊 Rate limit: ${this.MAX_REQUESTS_PER_WINDOW} requests per ${this.TIME_WINDOW_MS/1000} seconds`);
        console.log(`⏰ Block duration: ${this.BLOCK_DURATION_MS/1000/60} minutes`);
    }

    /**
     * Check if a request should be blocked based on rate limiting and bot detection
     * @param {string} clientIP - The client's IP address
     * @param {string} userAgent - The client's user agent
     * @param {Object} headers - Request headers
     * @returns {Object} - { blocked: boolean, reason: string, retryAfter: number }
     */
    checkRequest(clientIP, userAgent = '', headers = {}) {
        const now = Date.now();
        
        // Check if IP is currently blocked
        if (this.isIPBlocked(clientIP, now)) {
            const blockedUntil = this.ipRequestTracker.get(clientIP)?.blockedUntil || now;
            const retryAfter = Math.ceil((blockedUntil - now) / 1000);
            
            return {
                blocked: true,
                reason: 'IP address is temporarily blocked due to suspicious activity',
                retryAfter: retryAfter,
                ruleTriggered: 'IP_BLOCKED'
            };
        }

        // Check for bot user agents
        if (this.isBotUserAgent(userAgent)) {
            this.flagSuspiciousIP(clientIP, 'BOT_USER_AGENT');
            return {
                blocked: true,
                reason: 'Request blocked: Bot user agent detected',
                retryAfter: Math.ceil(this.BLOCK_DURATION_MS / 1000),
                ruleTriggered: 'BOT_USER_AGENT'
            };
        }

        // Check for suspicious headers
        const suspiciousHeaderCheck = this.checkSuspiciousHeaders(headers);
        if (suspiciousHeaderCheck.suspicious) {
            this.flagSuspiciousIP(clientIP, suspiciousHeaderCheck.reason);
            return {
                blocked: true,
                reason: `Request blocked: ${suspiciousHeaderCheck.reason}`,
                retryAfter: Math.ceil(this.BLOCK_DURATION_MS / 1000),
                ruleTriggered: 'SUSPICIOUS_HEADERS'
            };
        }

        // Rate limiting check
        const rateLimitCheck = this.checkRateLimit(clientIP, now);
        if (rateLimitCheck.exceeded) {
            // Block the IP for the configured duration
            this.blockIP(clientIP, now + this.BLOCK_DURATION_MS, 'RATE_LIMIT_EXCEEDED');
            
            return {
                blocked: true,
                reason: `Rate limit exceeded: More than ${this.MAX_REQUESTS_PER_WINDOW} requests in ${this.TIME_WINDOW_MS/1000} seconds`,
                retryAfter: Math.ceil(this.BLOCK_DURATION_MS / 1000),
                ruleTriggered: 'RATE_LIMIT'
            };
        }

        // Record the request
        this.recordRequest(clientIP, now);

        return {
            blocked: false,
            reason: null,
            retryAfter: 0,
            ruleTriggered: null
        };
    }

    /**
     * Check if an IP address is currently blocked
     */
    isIPBlocked(clientIP, now = Date.now()) {
        const ipData = this.ipRequestTracker.get(clientIP);
        if (!ipData || !ipData.blocked) {
            return false;
        }

        // Check if block has expired
        if (ipData.blockedUntil && now >= ipData.blockedUntil) {
            // Unblock the IP
            ipData.blocked = false;
            ipData.blockedUntil = null;
            this.blockedIPs.delete(clientIP);
            console.log(`🔓 IP ${clientIP} has been unblocked (block expired)`);
            return false;
        }

        return true;
    }

    /**
     * Check if user agent matches bot patterns
     */
    isBotUserAgent(userAgent) {
        if (!userAgent || userAgent.trim() === '') {
            return true; // Block empty user agents
        }

        return this.BOT_USER_AGENTS.some(pattern => pattern.test(userAgent));
    }

    /**
     * Check for suspicious headers that might indicate bot activity
     */
    checkSuspiciousHeaders(headers) {
        // Check for missing common browser headers
        const hasAccept = headers.accept || headers.Accept;
        const hasAcceptLanguage = headers['accept-language'] || headers['Accept-Language'];
        const hasAcceptEncoding = headers['accept-encoding'] || headers['Accept-Encoding'];

        if (!hasAccept || !hasAcceptLanguage || !hasAcceptEncoding) {
            return {
                suspicious: true,
                reason: 'Missing common browser headers'
            };
        }

        // Check for suspicious header combinations
        const userAgent = headers['user-agent'] || headers['User-Agent'] || '';
        const referer = headers.referer || headers.Referer || '';

        // Suspicious if claims to be a browser but has no referer and suspicious accept headers
        if (userAgent.includes('Mozilla') && !referer && hasAccept === '*/*') {
            return {
                suspicious: true,
                reason: 'Suspicious header combination'
            };
        }

        return { suspicious: false };
    }

    /**
     * Check rate limiting for an IP
     */
    checkRateLimit(clientIP, now) {
        const ipData = this.ipRequestTracker.get(clientIP) || { requests: [], blocked: false };
        
        // Filter requests within the time window
        const recentRequests = ipData.requests.filter(timestamp => 
            now - timestamp <= this.TIME_WINDOW_MS
        );

        // Check if rate limit is exceeded
        if (recentRequests.length >= this.MAX_REQUESTS_PER_WINDOW) {
            console.log(`🚫 Rate limit exceeded for IP ${clientIP}: ${recentRequests.length} requests in ${this.TIME_WINDOW_MS/1000}s`);
            return { exceeded: true, requestCount: recentRequests.length };
        }

        return { exceeded: false, requestCount: recentRequests.length };
    }

    /**
     * Record a request from an IP
     */
    recordRequest(clientIP, timestamp = Date.now()) {
        const ipData = this.ipRequestTracker.get(clientIP) || { requests: [], blocked: false };
        
        // Add the new request timestamp
        ipData.requests.push(timestamp);
        
        // Keep only requests within the time window (plus some buffer for analysis)
        const cutoff = timestamp - (this.TIME_WINDOW_MS * 2);
        ipData.requests = ipData.requests.filter(ts => ts > cutoff);
        
        this.ipRequestTracker.set(clientIP, ipData);
    }

    /**
     * Block an IP address
     */
    blockIP(clientIP, blockedUntil, reason) {
        const ipData = this.ipRequestTracker.get(clientIP) || { requests: [] };
        ipData.blocked = true;
        ipData.blockedUntil = blockedUntil;
        ipData.blockReason = reason;
        ipData.blockedAt = Date.now();
        
        this.ipRequestTracker.set(clientIP, ipData);
        this.blockedIPs.add(clientIP);
        
        const duration = Math.ceil((blockedUntil - Date.now()) / 1000 / 60);
        console.log(`🔒 IP ${clientIP} blocked for ${duration} minutes. Reason: ${reason}`);
    }

    /**
     * Flag an IP as suspicious
     */
    flagSuspiciousIP(clientIP, reason) {
        this.suspiciousIPs.add(clientIP);
        console.log(`⚠️ IP ${clientIP} flagged as suspicious. Reason: ${reason}`);
    }

    /**
     * Manually unblock an IP (admin function)
     */
    unblockIP(clientIP) {
        const ipData = this.ipRequestTracker.get(clientIP);
        if (ipData) {
            ipData.blocked = false;
            ipData.blockedUntil = null;
            delete ipData.blockReason;
            delete ipData.blockedAt;
        }
        
        this.blockedIPs.delete(clientIP);
        this.suspiciousIPs.delete(clientIP);
        
        console.log(`🔓 IP ${clientIP} manually unblocked`);
        return true;
    }

    /**
     * Get statistics about blocked and suspicious IPs
     */
    getStats() {
        const now = Date.now();
        const activeBlocks = [];
        const expiredBlocks = [];
        
        for (const [ip, data] of this.ipRequestTracker.entries()) {
            if (data.blocked) {
                if (data.blockedUntil && now >= data.blockedUntil) {
                    expiredBlocks.push(ip);
                } else {
                    activeBlocks.push({
                        ip,
                        blockedAt: data.blockedAt,
                        blockedUntil: data.blockedUntil,
                        reason: data.blockReason,
                        remainingTime: data.blockedUntil ? Math.ceil((data.blockedUntil - now) / 1000) : 0
                    });
                }
            }
        }

        return {
            activeBlocks: activeBlocks.length,
            activeBlockedIPs: activeBlocks,
            suspiciousIPs: Array.from(this.suspiciousIPs),
            totalTrackedIPs: this.ipRequestTracker.size,
            expiredBlocks: expiredBlocks.length,
            config: {
                maxRequestsPerWindow: this.MAX_REQUESTS_PER_WINDOW,
                timeWindowSeconds: this.TIME_WINDOW_MS / 1000,
                blockDurationMinutes: this.BLOCK_DURATION_MS / 1000 / 60
            }
        };
    }

    /**
     * Clean up old data to prevent memory leaks
     */
    cleanup() {
        const now = Date.now();
        const cutoff = now - (this.TIME_WINDOW_MS * 10); // Keep data for 10x the window size
        
        let cleaned = 0;
        for (const [ip, data] of this.ipRequestTracker.entries()) {
            // Remove old requests
            const originalLength = data.requests.length;
            data.requests = data.requests.filter(timestamp => timestamp > cutoff);
            
            // If IP is not blocked and has no recent requests, remove it entirely
            if (!data.blocked && data.requests.length === 0) {
                this.ipRequestTracker.delete(ip);
                this.suspiciousIPs.delete(ip);
                cleaned++;
            } else if (data.requests.length < originalLength) {
                this.ipRequestTracker.set(ip, data);
            }
        }
        
        if (cleaned > 0) {
            console.log(`🧹 Cleaned up ${cleaned} old IP records`);
        }
    }

    /**
     * Start the cleanup interval
     */
    startCleanupInterval() {
        setInterval(() => {
            this.cleanup();
        }, this.CLEANUP_INTERVAL_MS);
    }

    /**
     * Get blocked IPs list for external firewall configuration
     */
    getBlockedIPsList() {
        return Array.from(this.blockedIPs);
    }

    /**
     * Export configuration for Vercel firewall rules
     */
    generateVercelFirewallConfig() {
        const blockedIPs = this.getBlockedIPsList();
        
        if (blockedIPs.length === 0) {
            return null;
        }

        return {
            routes: blockedIPs.map(ip => ({
                src: "/(.*)",
                has: [
                    {
                        type: "header",
                        key: "x-forwarded-for",
                        value: ip
                    }
                ],
                mitigate: {
                    action: "deny"
                }
            }))
        };
    }
}

module.exports = BotBlockingService;
