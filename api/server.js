const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const Joi = require('joi');
const path = require('path');
require('dotenv').config();

const { SparkWallet } = require('@buildonspark/spark-sdk');
const TokenService = require('../services/TokenService');
const RateLimitService = require('../services/RateLimitService');
const TurnstileService = require('../services/TurnstileService');
const BotBlockingService = require('../services/BotBlockingService');

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: [
                "'self'",
                "'unsafe-inline'",
                "https://challenges.cloudflare.com"
            ],
            styleSrc: [
                "'self'",
                "'unsafe-inline'",
                "https://fonts.googleapis.com"
            ],
            fontSrc: [
                "'self'",
                "https://fonts.gstatic.com"
            ],
            connectSrc: [
                "'self'",
                "https://challenges.cloudflare.com"
            ],
            frameSrc: [
                "https://challenges.cloudflare.com"
            ]
        }
    }
}));
app.use(cors({
    origin: ['http://localhost:8000', 'http://127.0.0.1:8000', 'http://localhost:54962', 'http://127.0.0.1:54962', 'https://ordi-bird-85k80lvtn-ecurrencyhodlers-projects.vercel.app', 'https://www.ordibird.com', 'https://ordibird.com'],
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Serve static files from the root directory (for local development)
if (require.main === module) {
    app.use(express.static(path.join(__dirname, '..')));
}

// Rate limiting
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 86400000, // 24 hours
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 1, // 1 request per window
    message: {
        error: 'Rate limit exceeded. Only 1 token claim per day allowed.',
        retryAfter: '24 hours'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Initialize services
const tokenService = new TokenService();
const rateLimitService = new RateLimitService();
const turnstileService = new TurnstileService();
const botBlockingService = new BotBlockingService();

// Bot blocking middleware
const botBlockingMiddleware = (req, res, next) => {
    // Extract client IP with proper priority order as per Cloudflare documentation
    const clientIP = req.headers['cf-connecting-ip'] || 
                     req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                     req.headers['x-real-ip'] ||
                     req.connection.remoteAddress ||
                     req.socket.remoteAddress ||
                     req.ip ||
                     'unknown';

    const userAgent = req.headers['user-agent'] || '';
    const headers = req.headers;

    // Check if request should be blocked
    const blockCheck = botBlockingService.checkRequest(clientIP, userAgent, headers);
    
    if (blockCheck.blocked) {
        console.log(`🚫 Request blocked from ${clientIP}: ${blockCheck.reason}`);
        
        return res.status(429).json({
            success: false,
            error: blockCheck.reason,
            retryAfter: blockCheck.retryAfter,
            ruleTriggered: blockCheck.ruleTriggered,
            clientIP: clientIP.substring(0, 8) + '***' // Partially hide IP for privacy
        });
    }

    // Add client info to request for logging
    req.clientInfo = {
        ip: clientIP,
        userAgent: userAgent,
        blocked: false
    };

    next();
};

// Apply bot blocking middleware to API routes (excluding admin security endpoints)
app.use('/api', (req, res, next) => {
    // Skip bot blocking for admin security endpoints
    if (req.path.startsWith('/security/') && req.headers.authorization) {
        return next();
    }
    return botBlockingMiddleware(req, res, next);
});

// Validation schemas
const claimTokenSchema = Joi.object({
    sparkAddress: Joi.string()
        .pattern(/^sp1[a-zA-Z0-9]{20,}$/)
        .required()
        .messages({
            'string.pattern.base': 'Invalid Spark address format (should start with "sp1" and be at least 20 characters long)',
            'any.required': 'Spark address is required'
        }),
    turnstileToken: Joi.string()
        .required()
        .messages({
            'any.required': 'Turnstile token is required'
        })
});


// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        network: process.env.SPARK_NETWORK || 'mainnet'
    });
});

// Get Turnstile site key endpoint (public key only)
app.get('/api/turnstile/sitekey', (req, res) => {
    res.json({
        success: true,
        siteKey: process.env.TURNSTILE_SITE_KEY
    });
});


// Get token info endpoint
app.get('/api/token/info', async (req, res) => {
    try {
        await initializeServices();
        const tokenInfo = await tokenService.getTokenInfo();
        res.json({
            success: true,
            data: tokenInfo
        });
    } catch (error) {
        console.error('Error getting token info:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get token information'
        });
    }
});

// Generate new regtest Spark address endpoint
app.get('/api/address/generate', async (req, res) => {
    try {
        const addressInfo = await tokenService.generateRegtestAddress();
        res.json({
            success: true,
            data: addressInfo
        });
    } catch (error) {
        console.error('Error generating regtest address:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate regtest address'
        });
    }
});

// Get current wallet address endpoint
app.get('/api/address/current', async (req, res) => {
    try {
        const addressInfo = await tokenService.getCurrentAddress();
        res.json({
            success: true,
            data: addressInfo
        });
    } catch (error) {
        console.error('Error getting current address:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get current address'
        });
    }
});

// Get blocked addresses endpoint
app.get('/api/blocklist', async (req, res) => {
    try {
        await initializeServices();
        const blockedAddresses = tokenService.getBlockedAddresses();
        res.json({
            success: true,
            data: {
                blockedAddresses,
                count: blockedAddresses.length
            }
        });
    } catch (error) {
        console.error('Error getting blocked addresses:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get blocked addresses'
        });
    }
});

// Add address to blocklist endpoint (admin only - requires auth header)
app.post('/api/blocklist/add', async (req, res) => {
    try {
        // Simple admin authentication check
        const authHeader = req.headers.authorization;
        if (!authHeader || authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized - Admin access required'
            });
        }

        await initializeServices();
        
        const { address } = req.body;
        if (!address) {
            return res.status(400).json({
                success: false,
                error: 'Address is required'
            });
        }

        // Validate address format
        const { error } = Joi.string().pattern(/^sp1[a-zA-Z0-9]{20,}$/).validate(address);
        if (error) {
            return res.status(400).json({
                success: false,
                error: 'Invalid Spark address format'
            });
        }

        tokenService.addBlockedAddress(address);
        
        res.json({
            success: true,
            data: {
                message: `Address ${address} added to blocklist`,
                blockedAddresses: tokenService.getBlockedAddresses()
            }
        });
    } catch (error) {
        console.error('Error adding address to blocklist:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to add address to blocklist'
        });
    }
});

// Remove address from blocklist endpoint (admin only - requires auth header)
app.post('/api/blocklist/remove', async (req, res) => {
    try {
        // Simple admin authentication check
        const authHeader = req.headers.authorization;
        if (!authHeader || authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized - Admin access required'
            });
        }

        await initializeServices();
        
        const { address } = req.body;
        if (!address) {
            return res.status(400).json({
                success: false,
                error: 'Address is required'
            });
        }

        const removed = tokenService.removeBlockedAddress(address);
        
        if (removed) {
            res.json({
                success: true,
                data: {
                    message: `Address ${address} removed from blocklist`,
                    blockedAddresses: tokenService.getBlockedAddresses()
                }
            });
        } else {
            res.status(404).json({
                success: false,
                error: 'Address not found in blocklist'
            });
        }
    } catch (error) {
        console.error('Error removing address from blocklist:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to remove address from blocklist'
        });
    }
});

// Bot blocking statistics endpoint (admin only)
app.get('/api/security/stats', async (req, res) => {
    try {
        // Simple admin authentication check
        const authHeader = req.headers.authorization;
        if (!authHeader || authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized - Admin access required'
            });
        }

        const stats = botBlockingService.getStats();
        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Error getting bot blocking stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get security statistics'
        });
    }
});

// Unblock IP endpoint (admin only)
app.post('/api/security/unblock', async (req, res) => {
    try {
        // Simple admin authentication check
        const authHeader = req.headers.authorization;
        if (!authHeader || authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized - Admin access required'
            });
        }

        const { ip } = req.body;
        if (!ip) {
            return res.status(400).json({
                success: false,
                error: 'IP address is required'
            });
        }

        const unblocked = botBlockingService.unblockIP(ip);
        
        res.json({
            success: true,
            data: {
                message: `IP ${ip} has been unblocked`,
                unblocked: unblocked
            }
        });
    } catch (error) {
        console.error('Error unblocking IP:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to unblock IP address'
        });
    }
});

// Generate Vercel firewall config endpoint (admin only)
app.get('/api/security/vercel-config', async (req, res) => {
    try {
        // Simple admin authentication check
        const authHeader = req.headers.authorization;
        if (!authHeader || authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized - Admin access required'
            });
        }

        const config = botBlockingService.generateVercelFirewallConfig();
        
        res.json({
            success: true,
            data: {
                config: config,
                blockedIPs: botBlockingService.getBlockedIPsList(),
                instructions: config ? 
                    'Add the routes configuration to your vercel.json file to block these IPs at the edge.' :
                    'No blocked IPs currently. Configuration will be generated when IPs are blocked.'
            }
        });
    } catch (error) {
        console.error('Error generating Vercel config:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate Vercel firewall configuration'
        });
    }
});

// Check if address has already claimed
app.get('/api/claim/status/:address', async (req, res) => {
    try {
        const { address } = req.params;

        // Validate address format
        const { error } = Joi.string().pattern(/^(spark|sprt)[a-zA-Z0-9]{20,}$/).validate(address);
        if (error) {
            return res.status(400).json({
                success: false,
                error: 'Invalid Spark address format'
            });
        }

        const hasClaimed = await rateLimitService.hasClaimedToday(address);
        const canClaim = !hasClaimed;

        res.json({
            success: true,
            data: {
                address,
                hasClaimed,
                canClaim,
                nextClaimAvailable: hasClaimed ? rateLimitService.getNextClaimTime(address) : null
            }
        });
    } catch (error) {
        console.error('Error checking claim status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to check claim status'
        });
    }
});

// Claim token endpoint with Turnstile verification - DISABLED
// app.post('/api/claim/token', async (req, res) => {
//     try {
//         // Step 1: Validate request body
//         const { error, value } = claimTokenSchema.validate(req.body);
//         if (error) {
//             return res.status(400).json({
//                 success: false,
//                 error: error.details[0].message
//             });
//         }

//         const { sparkAddress, turnstileToken } = req.body;

//         // Step 2: Verify Turnstile token
//         console.log('🔐 Verifying Turnstile token...');
//         console.log('Token length:', turnstileToken.length);
//         console.log('Token preview:', turnstileToken.substring(0, 50) + '...');
        
//         // Extract client IP with proper priority order as per Cloudflare documentation
//         const clientIP = req.headers['cf-connecting-ip'] || 
//                          req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
//                          req.headers['x-real-ip'] ||
//                          req.connection.remoteAddress ||
//                          req.socket.remoteAddress ||
//                          req.ip ||
//                          'unknown';
//         console.log('Client IP:', clientIP);
        
//         const turnstileResult = await turnstileService.verifyToken(turnstileToken, clientIP);
//         console.log('Turnstile verification result:', turnstileResult);
        
//         if (!turnstileService.isHuman(turnstileResult)) {
//             console.log(`🤖 Turnstile verification failed: ${turnstileResult.error}`);
//             console.log('Error codes:', turnstileResult.errorCodes);
//             return res.status(400).json({
//                 success: false,
//                 error: turnstileService.getErrorMessage(turnstileResult)
//             });
//         }

//         console.log(`✅ Turnstile verification successful`);
        
//         // Step 3: Initialize services
//         await initializeServices();

//         // Step 4: Check global rate limit first
//         if (rateLimitService.isGlobalRateLimitExceeded()) {
//             const globalStats = rateLimitService.getGlobalMintStats();
//             console.log(`🚫 Global rate limit exceeded: ${globalStats.tokensThisMinute}/${globalStats.maxTokensPerMinute} tokens this minute`);
//             return res.status(429).json({
//                 success: false,
//                 error: 'Only 20 tokens can be claimed every minute. Please wait before trying to claim your token again.',
//                 globalStats: globalStats
//             });
//         }

//         // Step 5: Rate limiting (disabled for testing)
//         // const hasClaimed = await rateLimitService.hasClaimedToday(sparkAddress);
//         // if (hasClaimed) {
//         //     return res.status(429).json({
//         //         success: false,
//         //         error: 'Address has already claimed a token today',
//         //         retryAfter: rateLimitService.getNextClaimTime(sparkAddress)
//         //     });
//         // }

//         // Step 6: Process token claim
//         console.log(`🪙 Processing token claim for ${sparkAddress}`);
//         const result = await tokenService.claimToken(sparkAddress);

//         // Step 7: Record the claim and global mint
//         await rateLimitService.recordClaim(sparkAddress);
//         rateLimitService.recordGlobalMint();

//         res.json({
//             success: true,
//             data: {
//                 transactionHash: result.txHash,
//                 sparkAddress,
//                 tokenAmount: result.amount,
//                 timestamp: new Date().toISOString(),
//                 turnstileVerified: true
//             }
//         });

//     } catch (error) {
//         console.error('Error claiming token:', error);
//         console.error('Error stack:', error.stack);
//         console.error('Error message:', error.message);

//         // Handle specific error types
//         if (error.message.includes('insufficient funds')) {
//             return res.status(500).json({
//                 success: false,
//                 error: 'Insufficient funds for token minting'
//             });
//         }

//         if (error.message.includes('invalid address')) {
//             return res.status(400).json({
//                 success: false,
//                 error: 'Invalid Spark address'
//             });
//         }

//         if (error.message.includes('Turnstile')) {
//             return res.status(400).json({
//                 success: false,
//                 error: 'Turnstile verification failed. Please try again.'
//             });
//         }

//         // Return more detailed error for debugging
//         res.status(500).json({
//             success: false,
//             error: `Failed to claim token: ${error.message}`,
//             details: error.stack ? error.stack.split('\n')[0] : 'No stack trace available'
//         });
//     }
// });

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found'
    });
});

// Initialize token service on first request
let isInitialized = false;

async function initializeServices() {
    if (!isInitialized) {
        try {
            await tokenService.initialize();
            console.log('✅ Token service initialized');
            isInitialized = true;
        } catch (error) {
            console.error('❌ Failed to initialize token service:', error);
            throw error;
        }
    }
}


// For Vercel serverless functions, we need to export a handler function
module.exports = async (req, res) => {
    // Only initialize services for endpoints that need them
    const needsInitialization = req.url && (
        req.url.includes('/api/claim/token') ||
        req.url.includes('/api/token/info') ||
        req.url.includes('/api/blocklist') ||
        req.url.includes('/api/address')
    );
    
    if (needsInitialization) {
        try {
            await initializeServices();
        } catch (error) {
            console.error('Service initialization failed:', error);
            return res.status(500).json({
                success: false,
                error: 'Service initialization failed'
            });
        }
    }
    
    // Handle the request with the Express app
    return app(req, res);
};

// Also export the app for local development
module.exports.app = app;

// Start server for local development
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`🚀 OrdiBird server running on port ${PORT}`);
        console.log(`🔐 Turnstile + Rate Limiting protection enabled`);
        console.log(`🌐 Network: ${process.env.SPARK_NETWORK || 'mainnet'}`);
    });
}
