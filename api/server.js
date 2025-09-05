const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const Joi = require('joi');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
require('dotenv').config();

const { SparkWallet } = require('@buildonspark/spark-sdk');
const TokenService = require('../services/TokenService');
const RateLimitService = require('../services/RateLimitService');

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors({
    origin: ['http://localhost:8000', 'http://127.0.0.1:8000', 'http://localhost:54962', 'http://127.0.0.1:54962', 'https://ordi-bird-85k80lvtn-ecurrencyhodlers-projects.vercel.app', 'https://www.ordibird.com', 'https://ordibird.com'],
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));

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

// Validation schemas
const claimTokenSchema = Joi.object({
    sparkAddress: Joi.string()
        .pattern(/^sp1[a-zA-Z0-9]{20,}$/)
        .required()
        .messages({
            'string.pattern.base': 'Invalid Spark address format (should start with "sp1" and be at least 20 characters long)',
            'any.required': 'Spark address is required'
        })
});

// Challenge generation endpoint for bot prevention
app.post('/api/get-challenge', (req, res) => {
    try {
        const challengeId = crypto.randomUUID();
        const timestamp = Date.now();
        const randomData = crypto.randomBytes(16).toString('hex');
        
        // Create challenge data
        const challengeData = {
            id: challengeId,
            timestamp: timestamp,
            data: randomData,
            difficulty: 3
        };
        
        // Create JWT token containing challenge data (expires in 5 minutes)
        const challengeToken = jwt.sign(challengeData, process.env.JWT_SECRET, { 
            expiresIn: '5m' 
        });
        
        console.log(`🔐 Challenge generated: ${challengeId}`);
        
        res.json({
            challengeId: challengeId,
            challengeToken: challengeToken,
            timestamp: timestamp,
            data: randomData,
            difficulty: challengeData.difficulty
        });
        
    } catch (error) {
        console.error('Challenge generation failed:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate challenge'
        });
    }
});

// Challenge validation function
function validateChallenge(challengeToken, clientSolution) {
    try {
        // Verify and decode JWT token
        const challengeData = jwt.verify(challengeToken, process.env.JWT_SECRET);
        
        // Calculate expected solution using the same algorithm as frontend
        const expectedSolution = calculateExpectedSolution(challengeData);
        
        if (clientSolution !== expectedSolution) {
            return { valid: false, reason: 'Invalid solution' };
        }
        
        console.log(`✅ Challenge validated: ${challengeData.id}`);
        return { valid: true };
        
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return { valid: false, reason: 'Challenge expired' };
        }
        if (error.name === 'JsonWebTokenError') {
            return { valid: false, reason: 'Invalid challenge token' };
        }
        console.error('Challenge validation error:', error);
        return { valid: false, reason: 'Validation error' };
    }
}

// Calculate expected solution (must match frontend algorithm)
function calculateExpectedSolution(challengeData, clientDomain = null) {
    const { data, timestamp, difficulty } = challengeData;
    
    let result = data;
    
    // Apply transformations based on difficulty
    for (let i = 0; i < difficulty; i++) {
        // Hash the result
        result = Buffer.from(result).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
        
        // Add timestamp influence
        const timeInfluence = (timestamp % 1000).toString();
        result = result + timeInfluence;
        
        // Reverse every other iteration
        if (i % 2 === 1) {
            result = result.split('').reverse().join('');
        }
        
        // Take substring
        result = result.substring(0, 32);
    }
    
    // Final transformation with domain-specific secret
    // Use a consistent domain secret that works for all environments
    const domainSecret = 'ordibird-game-secret'; // Consistent across all domains
    const finalResult = Buffer.from(result + domainSecret).toString('base64').substring(0, 24);
    
    return finalResult;
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        network: process.env.SPARK_NETWORK || 'mainnet'
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

// Claim token endpoint with challenge validation
app.post('/api/claim/token', async (req, res) => {
    try {
        // Step 1: Validate challenge first
        const challengeToken = req.headers['x-challenge-token'];
        const challengeSolution = req.headers['x-challenge-solution'];
        
        if (!challengeToken || !challengeSolution) {
            return res.status(400).json({
                success: false,
                error: 'Security verification required. Please try again.'
            });
        }
        
        const validation = validateChallenge(challengeToken, challengeSolution);
        if (!validation.valid) {
            console.log(`� Challenge validation failed: ${validation.reason}`);
            return res.status(400).json({
                success: false,
                error: 'Security verification failed. Please try again.'
            });
        }
        
        console.log('🔐 Challenge validation successful');
        
        // Step 2: Initialize services
        await initializeServices();
        
        // Step 3: Validate request body
        const { error, value } = claimTokenSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                error: error.details[0].message
            });
        }

        const { sparkAddress } = value;

        // Step 4: Check global rate limit first
        if (rateLimitService.isGlobalRateLimitExceeded()) {
            const globalStats = rateLimitService.getGlobalMintStats();
            console.log(`🚫 Global rate limit exceeded: ${globalStats.tokensThisMinute}/${globalStats.maxTokensPerMinute} tokens this minute`);
            return res.status(429).json({
                success: false,
                error: 'Only 20 tokens can be claimed every minute. Please wait before trying to claim your token again.',
                globalStats: globalStats
            });
        }

        // Step 5: Rate limiting (disabled for testing)
        // const hasClaimed = await rateLimitService.hasClaimedToday(sparkAddress);
        // if (hasClaimed) {
        //     return res.status(429).json({
        //         success: false,
        //         error: 'Address has already claimed a token today',
        //         retryAfter: rateLimitService.getNextClaimTime(sparkAddress)
        //     });
        // }

        // Step 6: Process token claim
        console.log(`🪙 Processing token claim for ${sparkAddress}`);
        const result = await tokenService.claimToken(sparkAddress);

        // Step 7: Record the claim and global mint
        await rateLimitService.recordClaim(sparkAddress);
        rateLimitService.recordGlobalMint();

        res.json({
            success: true,
            data: {
                transactionHash: result.txHash,
                sparkAddress,
                tokenAmount: result.amount,
                timestamp: new Date().toISOString(),
                challengeValidated: true
            }
        });

    } catch (error) {
        console.error('Error claiming token:', error);
        console.error('Error stack:', error.stack);
        console.error('Error message:', error.message);

        // Handle specific error types
        if (error.message.includes('insufficient funds')) {
            return res.status(500).json({
                success: false,
                error: 'Insufficient funds for token minting'
            });
        }

        if (error.message.includes('invalid address')) {
            return res.status(400).json({
                success: false,
                error: 'Invalid Spark address'
            });
        }

        // Return more detailed error for debugging
        res.status(500).json({
            success: false,
            error: `Failed to claim token: ${error.message}`,
            details: error.stack ? error.stack.split('\n')[0] : 'No stack trace available'
        });
    }
});

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
    // Challenge generation doesn't need TokenService initialization
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
        console.log(`🔐 Challenge system enabled`);
        console.log(`🌐 Network: ${process.env.SPARK_NETWORK || 'mainnet'}`);
    });
}
