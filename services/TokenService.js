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
            console.log('🔗 RPC URL:', process.env.SPARK_RPC_URL || 'https://spark-mainnet-rpc.buildonbitcoin.com');
            
            // Initialize Spark wallet
            const { wallet } = await SparkWallet.initialize({
                network: process.env.SPARK_NETWORK || 'mainnet',
                rpcUrl: process.env.SPARK_RPC_URL || 'https://spark-mainnet-rpc.buildonbitcoin.com',
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
            
            // Amount: 1 BIRD token (1,000,000 units with 6 decimals)
            const mintAmount = 1000000n; // 1 token with 6 decimals
            
            console.log(`🪙 Step 1: Minting ${mintAmount} units of BIRD token to service wallet...`);
            
            // Step 1: Mint tokens to our service wallet
            const mintResult = await this.spark.mintTokens({
                tokenIdentifier: this.tokenId,
                tokenAmount: mintAmount
            });
            
            console.log('✅ Step 1 complete: Tokens minted to service wallet');
            console.log('📝 Mint transaction hash:', mintResult);
            
            console.log(`🔄 Step 2: Transferring ${mintAmount} units to user address: ${sparkAddress}`);
            
            // Step 2: Transfer the minted tokens from our wallet to the user's address
            const transferResult = await this.spark.transferTokens({
                tokenIdentifier: this.tokenId,
                tokenAmount: mintAmount,
                receiverSparkAddress: sparkAddress
            });
            
            console.log('✅ Step 2 complete: Tokens transferred to user');
            console.log('📝 Transfer transaction hash:', transferResult);

            return {
                txHash: transferResult, // Return the transfer transaction hash as primary
                mintTxHash: mintResult, // Also include the mint transaction hash
                amount: mintAmount.toString(),
                tokenId: this.tokenId,
                steps: {
                    mint: mintResult,
                    transfer: transferResult
                }
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
            
            console.log(`🪙 Mock Step 1: Minting ${mintAmount} units to service wallet...`);
            
            // Simulate mint processing time
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Generate mock mint transaction hash
            const mockMintTxHash = 'mock_mint_tx_' + Math.random().toString(36).substr(2, 9);
            console.log('✅ Mock Step 1 complete: Tokens minted to service wallet');
            console.log('📝 Mock mint transaction hash:', mockMintTxHash);
            
            console.log(`🔄 Mock Step 2: Transferring ${mintAmount} units to user address: ${sparkAddress}`);
            
            // Simulate transfer processing time
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Generate mock transfer transaction hash
            const mockTransferTxHash = 'mock_transfer_tx_' + Math.random().toString(36).substr(2, 9);
            console.log('✅ Mock Step 2 complete: Tokens transferred to user');
            console.log('📝 Mock transfer transaction hash:', mockTransferTxHash);

            return {
                txHash: mockTransferTxHash, // Return the transfer transaction hash as primary
                mintTxHash: mockMintTxHash, // Also include the mint transaction hash
                amount: mintAmount.toString(),
                tokenId: this.tokenId,
                steps: {
                    mint: mockMintTxHash,
                    transfer: mockTransferTxHash
                }
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
