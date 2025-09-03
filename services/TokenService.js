const { IssuerSparkWallet } = require('@buildonspark/issuer-sdk');
const fs = require('fs');

class TokenService {
    constructor() {
        this.issuerWallet = null;
        this.tokenId = null;
        this.isInitialized = false;
        this.tokenInfo = null;
    }

    async initialize() {
        try {
            console.log('🔧 Initializing Issuer Spark wallet...');
            console.log('🌐 Network:', process.env.SPARK_NETWORK || 'mainnet');
            
            // Initialize Issuer Spark wallet with the same mnemonic used for deployment
            const { wallet, mnemonic } = await IssuerSparkWallet.initialize({
                mnemonicOrSeed: process.env.SPARK_MNEMONIC,
                options: {
                    network: process.env.SPARK_NETWORK || 'mainnet',
                },
            });
            
            this.issuerWallet = wallet;
            
            // Load token info from deployment
            await this.loadTokenInfo();
            
            this.isInitialized = true;
            console.log('✅ Issuer Spark wallet initialized successfully');
            console.log('🆔 Token ID:', this.tokenId);
        } catch (error) {
            console.error('❌ Failed to initialize Issuer Spark wallet:', error);
            throw error;
        }
    }

    async loadTokenInfo() {
        try {
            // Load token info from the deployment file if it exists
            if (fs.existsSync('bird-token-info.json')) {
                const tokenData = JSON.parse(fs.readFileSync('bird-token-info.json', 'utf8'));
                this.tokenInfo = tokenData;
                console.log('✅ Token deployment info loaded');
            } else {
                console.log('⚠️ No token deployment info found');
            }
            
            // Get the token identifier from wallet balance (use bech32 format key for transfers)
            try {
                const balance = await this.issuerWallet.getBalance();
                if (balance && balance.tokenBalances) {
                    for (const [tokenId, tokenBalance] of balance.tokenBalances) {
                        this.tokenId = tokenId; // Use bech32 format key
                        console.log('✅ Token ID loaded from wallet (bech32):', this.tokenId);
                        if (tokenBalance.tokenMetadata && tokenBalance.tokenMetadata.rawTokenIdentifier) {
                            console.log('✅ Raw Token ID (hex):', tokenBalance.tokenMetadata.rawTokenIdentifier.toString('hex'));
                        }
                        return;
                    }
                }
                
                // Fallback to environment variable if available
                this.tokenId = process.env.TOKEN_ID;
                if (this.tokenId) {
                    console.log('✅ Token ID loaded from environment (fallback):', this.tokenId);
                } else {
                    console.log('⚠️ TOKEN_ID not found in environment variables or wallet');
                }
            } catch (balanceError) {
                console.log('⚠️ Could not get wallet balance, using env TOKEN_ID');
                this.tokenId = process.env.TOKEN_ID;
                if (this.tokenId) {
                    console.log('✅ Token ID loaded from environment:', this.tokenId);
                } else {
                    console.log('⚠️ TOKEN_ID not found in environment variables');
                }
            }
        } catch (error) {
            console.error('❌ Failed to load token info:', error);
            throw error;
        }
    }

    async claimToken(sparkAddress) {
        if (!this.isInitialized) {
            throw new Error('Token service not initialized');
        }

        if (!this.tokenId) {
            throw new Error('Token ID not found. Please ensure the token was properly deployed.');
        }

        try {
            console.log(`🎯 Processing token claim for address: ${sparkAddress}`);
            console.log(`🆔 Using token ID: ${this.tokenId}`);
            
            // Amount: 1 BIRD token (1,000,000 units with 6 decimals)
            const mintAmount = 1000000n; // 1 token with 6 decimals
            
            console.log(`🪙 Step 1: Minting ${mintAmount} units of BIRD token to issuer wallet...`);
            
            // Step 1: Mint tokens to our issuer wallet
            const mintResult = await this.issuerWallet.mintTokens(mintAmount);
            
            console.log('✅ Step 1 complete: Tokens minted to issuer wallet');
            console.log('📝 Mint result:', mintResult);
            
            // Extract transaction hash from mint result
            let mintTxHash = null;
            if (typeof mintResult === 'string') {
                mintTxHash = mintResult;
            } else if (mintResult && mintResult.txid) {
                mintTxHash = mintResult.txid;
            } else if (mintResult && mintResult.transactionId) {
                mintTxHash = mintResult.transactionId;
            } else if (mintResult && mintResult.hash) {
                mintTxHash = mintResult.hash;
            }
            
            // Wait a moment for the mint transaction to be processed
            console.log('⏳ Waiting for mint transaction to be processed...');
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            console.log(`🔄 Step 2: Transferring ${mintAmount} units to user address: ${sparkAddress}`);
            
            // Step 2: Transfer the minted tokens from our wallet to the user's address
            const transferResult = await this.issuerWallet.transferTokens({
                tokenIdentifier: this.tokenId,
                receiverSparkAddress: sparkAddress,
                tokenAmount: mintAmount
            });
            
            console.log('✅ Step 2 complete: Tokens transferred to user');
            console.log('📝 Transfer result:', transferResult);
            
            // Extract transaction hash from transfer result
            let transferTxHash = null;
            if (typeof transferResult === 'string') {
                transferTxHash = transferResult;
            } else if (transferResult && transferResult.txid) {
                transferTxHash = transferResult.txid;
            } else if (transferResult && transferResult.transactionId) {
                transferTxHash = transferResult.transactionId;
            } else if (transferResult && transferResult.hash) {
                transferTxHash = transferResult.hash;
            }

            // Note: Balance cache service removed for simplified testing
            console.log('📝 Transfer completed successfully');

            return {
                txHash: transferTxHash || transferResult, // Return the transfer transaction hash as primary
                mintTxHash: mintTxHash || mintResult, // Also include the mint transaction hash
                amount: mintAmount.toString(),
                tokenId: this.tokenId,
                steps: {
                    mint: mintResult,
                    transfer: transferResult
                }
            };

        } catch (error) {
            console.error('❌ Failed to claim token:', error);
            console.error('❌ Error details:', error.message);
            console.error('❌ Error stack:', error.stack);
            
            // Don't fall back to mock - report the actual error
            throw new Error(`Token claim failed: ${error.message}`);
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
            // Get current balance to show real token info
            let balance = '0';
            try {
                const walletBalance = await this.issuerWallet.getBalance();
                if (walletBalance && walletBalance.tokenBalances && this.tokenId) {
                    const tokenBalance = walletBalance.tokenBalances.get(this.tokenId);
                    if (tokenBalance) {
                        balance = tokenBalance.balance.toString();
                    }
                }
            } catch (balanceError) {
                console.log('⚠️ Could not get balance:', balanceError.message);
            }
            
            return {
                tokenId: this.tokenId,
                name: process.env.TOKEN_NAME || 'OrdiBird',
                ticker: process.env.TOKEN_TICKER || 'BIRD',
                decimals: parseInt(process.env.TOKEN_DECIMALS) || 6,
                balance: balance,
                maxSupply: process.env.TOKEN_MAX_SUPPLY || '0',
                deployed: this.tokenInfo ? this.tokenInfo.deployed : false,
                deploymentTime: this.tokenInfo ? this.tokenInfo.deploymentTime : null
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
            
            // Generate a new address using the issuer wallet
            const address = await this.issuerWallet.getSparkAddress();
            
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
            const address = await this.issuerWallet.getSparkAddress();
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
