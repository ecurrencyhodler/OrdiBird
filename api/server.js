const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const Joi = require('joi');
require('dotenv').config();

const { SparkWallet } = require('@buildonspark/spark-sdk');
const TokenService = require('../services/TokenService');
const RateLimitService = require('../services/RateLimitService');

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors({
    origin: ['http://localhost:8000', 'http://127.0.0.1:8000', 'http://localhost:54962', 'http://127.0.0.1:54962', 'https://ordi-bird-85k80lvtn-ecurrencyhodlers-projects.vercel.app'],
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

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        network: process.env.SPARK_NETWORK || 'mainnet'
    });
});

// Debug endpoint to test Spark SDK initialization
app.get('/api/debug/spark', async (req, res) => {
    try {
        console.log('🔍 Debug: Testing Spark SDK initialization...');
        console.log('🔍 Environment variables:');
        console.log('  SPARK_NETWORK:', process.env.SPARK_NETWORK);
        console.log('  SPARK_RPC_URL:', process.env.SPARK_RPC_URL);
        console.log('  SPARK_MNEMONIC exists:', !!process.env.SPARK_MNEMONIC);
        console.log('  SPARK_MNEMONIC length:', process.env.SPARK_MNEMONIC ? process.env.SPARK_MNEMONIC.length : 0);
        
        // Test Spark SDK import
        const { SparkWallet } = require('@buildonspark/spark-sdk');
        console.log('✅ Spark SDK imported successfully');
        
        // Test initialization
        const { wallet } = await SparkWallet.initialize({
            network: process.env.SPARK_NETWORK || 'mainnet',
            rpcUrl: process.env.SPARK_RPC_URL || 'https://spark-mainnet-rpc.buildonbitcoin.com',
            mnemonicOrSeed: process.env.SPARK_MNEMONIC,
        });
        
        console.log('✅ Spark wallet initialized successfully');
        
        // Test getting address
        const address = await wallet.getSparkAddress();
        console.log('✅ Got wallet address:', address);
        
        res.json({
            success: true,
            data: {
                sparkSdkImported: true,
                walletInitialized: true,
                address: address,
                network: process.env.SPARK_NETWORK || 'mainnet',
                rpcUrl: process.env.SPARK_RPC_URL || 'https://spark-mainnet-rpc.buildonbitcoin.com',
                mnemonicProvided: !!process.env.SPARK_MNEMONIC
            }
        });
        
    } catch (error) {
        console.error('❌ Debug error:', error);
        console.error('❌ Error stack:', error.stack);
        
        res.status(500).json({
            success: false,
            error: error.message,
            stack: error.stack,
            envVars: {
                SPARK_NETWORK: process.env.SPARK_NETWORK,
                SPARK_RPC_URL: process.env.SPARK_RPC_URL,
                SPARK_MNEMONIC_PROVIDED: !!process.env.SPARK_MNEMONIC,
                SPARK_MNEMONIC_LENGTH: process.env.SPARK_MNEMONIC ? process.env.SPARK_MNEMONIC.length : 0
            }
        });
    }
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

// Claim token endpoint (rate limiting disabled for testing)
app.post('/api/claim/token', async (req, res) => {
    try {
        // Initialize services first
        await initializeServices();
        
        // Validate request body
        const { error, value } = claimTokenSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                error: error.details[0].message
            });
        }

        const { sparkAddress } = value;

        // Rate limiting disabled for testing
        // const hasClaimed = await rateLimitService.hasClaimedToday(sparkAddress);
        // if (hasClaimed) {
        //     return res.status(429).json({
        //         success: false,
        //         error: 'Address has already claimed a token today',
        //         retryAfter: rateLimitService.getNextClaimTime(sparkAddress)
        //     });
        // }

        // Process token claim
        const result = await tokenService.claimToken(sparkAddress);

        // Record the claim
        await rateLimitService.recordClaim(sparkAddress);

        res.json({
            success: true,
            data: {
                transactionHash: result.txHash,
                sparkAddress,
                tokenAmount: result.amount,
                timestamp: new Date().toISOString()
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
    // Initialize services on first request
    await initializeServices();
    
    // Handle the request with the Express app
    return app(req, res);
};

// Also export the app for local development
module.exports.app = app;
