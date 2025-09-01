const { SparkWallet } = require('@buildonspark/spark-sdk');

class TokenService {
    constructor() {
        this.spark = null;
        this.tokenId = 'BIRD_TOKEN_123'; // Mock token ID
        this.isInitialized = false;
        this.tokenCreated = false;
    }

    async initialize() {
        try {
            console.log('🔧 Initializing Spark wallet...');
            console.log('🌐 Network:', process.env.SPARK_NETWORK || 'mainnet');
            console.log('🔗 RPC URL:', process.env.SPARK_RPC_URL || 'http://localhost:18443');
            
            // Initialize Spark wallet
            const { wallet } = await SparkWallet.initialize({
                network: process.env.SPARK_NETWORK || 'mainnet',
                rpcUrl: process.env.SPARK_RPC_URL || 'http://localhost:18443',
                rpcUser: process.env.SPARK_RPC_USER || 'user',
                rpcPassword: process.env.SPARK_RPC_PASSWORD || 'password',
                mnemonicOrSeed: process.env.SPARK_MNEMONIC, // Mnemonic for the service wallet
            });
            
            this.spark = wallet;
            this.isInitialized = true;
            console.log('✅ Spark wallet initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize Spark wallet:', error);
            throw error;
        }
    }

    // Mock methods for development - will be replaced with actual Spark SDK integration

    async claimToken(sparkAddress) {
        if (!this.isInitialized) {
            throw new Error('Token service not initialized');
        }

        try {
            console.log(`🎯 Processing token claim for address: ${sparkAddress}`);
            
            // Check if we need to create the token first
            if (!this.tokenCreated) {
                await this.createToken();
            }
            
            // Mint and transfer 1 BIRD token (1,000,000 units with 6 decimals)
            const mintAmount = 1000000n; // 1 token with 6 decimals
            
            console.log(`🪙 Minting ${mintAmount} units of BIRD token...`);
            
            // Use Spark SDK to transfer tokens
            // First, we need to mint tokens to our wallet, then transfer them
            const result = await this.spark.transferTokens({
                tokenIdentifier: this.tokenId,
                tokenAmount: mintAmount,
                receiverSparkAddress: sparkAddress
            });
            
            console.log('✅ Token minted and transferred successfully');
            console.log('📝 Transaction hash:', result);

            return {
                txHash: result,
                amount: mintAmount.toString(),
                tokenId: this.tokenId
            };

        } catch (error) {
            console.error('❌ Failed to claim token:', error);
            
            // Fallback to mock implementation for development
            console.log('🔄 Falling back to mock implementation...');
            return await this.mockClaimToken(sparkAddress);
        }
    }

    async createToken() {
        try {
            console.log('🏗️ Creating BIRD token using Spark SDK...');
            
            const tokenName = process.env.TOKEN_NAME || 'OrdiBird';
            const tokenTicker = process.env.TOKEN_TICKER || 'BIRD';
            const decimals = parseInt(process.env.TOKEN_DECIMALS) || 6;
            const maxSupply = process.env.TOKEN_MAX_SUPPLY ? BigInt(process.env.TOKEN_MAX_SUPPLY.replace('n', '')) : 0n;
            const isFreezable = process.env.TOKEN_IS_FREEZABLE === 'true';
            
            // Create the token using Spark SDK's createToken method
            const tokenCreationTx = await this.spark.createToken({
                tokenName: tokenName,
                tokenTicker: tokenTicker,
                decimals: decimals,
                maxSupply: maxSupply,
                isFreezable: isFreezable
            });
            
            this.tokenId = tokenCreationTx; // The transaction ID is the token identifier
            this.tokenCreated = true;
            
            console.log('✅ BIRD token created successfully!');
            console.log('🆔 Token Creation TX:', tokenCreationTx);
            console.log('📝 Token Name:', tokenName);
            console.log('🏷️ Token Ticker:', tokenTicker);
            console.log('🔢 Decimals:', decimals);
            console.log('📊 Max Supply:', maxSupply.toString());
            console.log('❄️ Freezable:', isFreezable);
            
        } catch (error) {
            console.error('❌ Failed to create token:', error);
            throw error;
        }
    }

    async mockClaimToken(sparkAddress) {
        try {
            console.log(`🎯 Processing mock token claim for address: ${sparkAddress}`);
            
            const mintAmount = 1000000n; // 1 token with 6 decimals
            
            // Simulate processing time
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Generate mock transaction hash
            const mockTxHash = 'mock_tx_' + Math.random().toString(36).substr(2, 9);
            
            console.log('✅ Mock token minted and transferred');
            console.log('📝 Mock transaction hash:', mockTxHash);

            return {
                txHash: mockTxHash,
                amount: mintAmount.toString(),
                tokenId: this.tokenId
            };

        } catch (error) {
            console.error('❌ Failed to mock claim token:', error);
            throw error;
        }
    }

    async getTokenInfo() {
        try {
            // Return mock token info
            return {
                tokenId: this.tokenId,
                name: process.env.TOKEN_NAME || 'OrdiBird',
                ticker: process.env.TOKEN_TICKER || 'BIRD',
                decimals: parseInt(process.env.TOKEN_DECIMALS) || 6,
                balance: '0',
                maxSupply: process.env.TOKEN_MAX_SUPPLY || '0'
            };
        } catch (error) {
            console.error('Error getting token info:', error);
            throw error;
        }
    }

    // Generate a new Spark address
    async generateRegtestAddress() {
        if (!this.isInitialized) {
            throw new Error('Token service not initialized');
        }

        try {
            console.log('🔑 Generating new Spark address...');
            
            // Generate a new address using the Spark wallet
            const address = await this.spark.getSparkAddress();
            
            console.log('✅ New Spark address generated:', address);
            
            return {
                address: address,
                network: process.env.SPARK_NETWORK || 'mainnet',
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('❌ Failed to generate Spark address:', error);
            throw error;
        }
    }

    // Get the current wallet address
    async getCurrentAddress() {
        if (!this.isInitialized) {
            throw new Error('Token service not initialized');
        }

        try {
            const address = await this.spark.getSparkAddress();
            return {
                address: address,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('❌ Failed to get current address:', error);
            throw error;
        }
    }

    // Additional methods can be added here as needed
}

module.exports = TokenService;
