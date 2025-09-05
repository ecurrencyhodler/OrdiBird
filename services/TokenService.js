const { IssuerSparkWallet } = require('@buildonspark/issuer-sdk');
const fs = require('fs');

class TokenService {
    constructor() {
        this.issuerWallet = null;
        this.tokenId = null;
        this.isInitialized = false;
        this.tokenInfo = null;
        // Blocklist of addresses that cannot receive tokens
        this.blockedAddresses = new Set([
            'sp1pgssx93dcxfmn9ylggcvqpfljecwgx83t947mztzkelhgfrg0x3zvfhsc30547'
        ]);
        // Transaction queue to prevent UTXO conflicts
        this.transactionQueue = [];
        this.isProcessingTransaction = false;
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
            // Skip JSON file loading and go straight to environment variables
            console.log('📋 Loading token info from environment variables...');
            
            // Use TOKEN_ID from environment variables directly
            this.tokenId = process.env.TOKEN_ID;
            if (this.tokenId) {
                console.log('✅ Token ID loaded from environment:', this.tokenId);
            } else {
                console.log('⚠️ TOKEN_ID not found in environment variables');
                throw new Error('TOKEN_ID environment variable is required');
            }

            // Set basic token info from environment variables
            this.tokenInfo = {
                deployed: true,
                deploymentTime: new Date().toISOString(),
                tokenId: this.tokenId
            };
            
            console.log('✅ Token deployment info loaded from environment');
        } catch (error) {
            console.error('❌ Failed to load token info:', error);
            throw error;
        }
    }

    // Queue transaction to prevent UTXO conflicts
    async queueTransaction(transactionFn) {
        return new Promise((resolve, reject) => {
            this.transactionQueue.push({ fn: transactionFn, resolve, reject });
            this.processQueue();
        });
    }

    async processQueue() {
        if (this.isProcessingTransaction || this.transactionQueue.length === 0) {
            return;
        }

        this.isProcessingTransaction = true;
        const { fn, resolve, reject } = this.transactionQueue.shift();

        try {
            const result = await fn();
            resolve(result);
        } catch (error) {
            reject(error);
        } finally {
            this.isProcessingTransaction = false;
            // Process next transaction in queue
            setTimeout(() => this.processQueue(), 100);
        }
    }

    async claimToken(sparkAddress) {
        if (!this.isInitialized) {
            throw new Error('Token service not initialized');
        }

        if (!this.tokenId) {
            throw new Error('Token ID not found. Please ensure the token was properly deployed.');
        }

        // Check if address is blocked
        if (this.isAddressBlocked(sparkAddress)) {
            throw new Error(`Address ${sparkAddress} is blocked from receiving tokens`);
        }

        // Queue this transaction to prevent UTXO conflicts
        return this.queueTransaction(async () => {
            return this.executeTokenClaim(sparkAddress);
        });
    }

    async executeTokenClaim(sparkAddress, retryCount = 0) {
        const maxRetries = 3;
        const retryDelay = 1000 * (retryCount + 1); // Exponential backoff: 1s, 2s, 3s
        
        try {
            console.log(`🎯 Processing token claim for address: ${sparkAddress} (attempt ${retryCount + 1}/${maxRetries + 1})`);
            console.log(`🆔 Using token ID: ${this.tokenId}`);
            
            // Amount: 1 BIRD token (1,000,000 units with 6 decimals)
            const mintAmount = 1000000n; // 1 token with 6 decimals
            
            console.log(`🪙 Step 1: Minting ${mintAmount} units of BIRD token to issuer wallet...`);
            
            // Step 1: Mint tokens to our issuer wallet with retry logic
            const mintResult = await this.retryTransaction(
                () => this.issuerWallet.mintTokens(mintAmount),
                'mint',
                retryCount
            );
            
            console.log('✅ Step 1 complete: Tokens minted to issuer wallet');
            console.log('📝 Mint result:', mintResult);
            
            // Extract transaction hash from mint result
            let mintTxHash = this.extractTransactionHash(mintResult);
            
            // Wait for the mint transaction to be processed
            console.log('⏳ Waiting for mint transaction to be processed...');
            await new Promise(resolve => setTimeout(resolve, 3000)); // Increased wait time
            
            console.log(`🔄 Step 2: Transferring ${mintAmount} units to user address: ${sparkAddress}`);
            
            // Step 2: Transfer the minted tokens from our wallet to the user's address with retry logic
            const transferResult = await this.retryTransaction(
                () => this.issuerWallet.transferTokens({
                    tokenIdentifier: this.tokenId,
                    receiverSparkAddress: sparkAddress,
                    tokenAmount: mintAmount
                }),
                'transfer',
                retryCount
            );
            
            console.log('✅ Step 2 complete: Tokens transferred to user');
            console.log('📝 Transfer result:', transferResult);
            
            // Extract transaction hash from transfer result
            let transferTxHash = this.extractTransactionHash(transferResult);

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
            
            // Check if this is a transaction conflict error and we can retry
            if (this.isTransactionConflictError(error) && retryCount < maxRetries) {
                console.log(`🔄 Transaction conflict detected, retrying in ${retryDelay}ms... (attempt ${retryCount + 1}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                return this.executeTokenClaim(sparkAddress, retryCount + 1);
            }
            
            // Provide user-friendly error messages
            if (this.isTransactionConflictError(error)) {
                throw new Error('Transaction conflict: Multiple users are claiming tokens simultaneously. Please try again in a few seconds.');
            } else if (error.message.includes('insufficient funds')) {
                throw new Error('Insufficient funds in the token issuer wallet. Please contact support.');
            } else if (error.message.includes('invalid address')) {
                throw new Error('Invalid Spark address provided.');
            }
            
            // Report the actual error for other cases
            throw new Error(`Token claim failed: ${error.message}`);
        }
    }

    // Helper method to extract transaction hash from various result formats
    extractTransactionHash(result) {
        if (typeof result === 'string') {
            return result;
        } else if (result && result.txid) {
            return result.txid;
        } else if (result && result.transactionId) {
            return result.transactionId;
        } else if (result && result.hash) {
            return result.hash;
        }
        return null;
    }

    // Helper method to check if error is a transaction conflict
    isTransactionConflictError(error) {
        const errorMessage = error.message.toLowerCase();
        return errorMessage.includes('transaction pre-empted') ||
               errorMessage.includes('existing transaction') ||
               errorMessage.includes('utxo') ||
               errorMessage.includes('already in progress') ||
               errorMessage.includes('conflicting transaction');
    }

    // Helper method to retry individual transactions
    async retryTransaction(transactionFn, operationType, baseRetryCount = 0) {
        const maxRetries = 2; // Fewer retries for individual operations
        let lastError;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const result = await transactionFn();
                if (attempt > 0) {
                    console.log(`✅ ${operationType} succeeded on retry attempt ${attempt + 1}`);
                }
                return result;
            } catch (error) {
                lastError = error;
                console.log(`⚠️ ${operationType} attempt ${attempt + 1} failed:`, error.message);
                
                if (this.isTransactionConflictError(error) && attempt < maxRetries) {
                    const delay = 500 * (attempt + 1); // 500ms, 1s
                    console.log(`🔄 Retrying ${operationType} in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    break;
                }
            }
        }

        throw lastError;
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

    // Check if an address is blocked from receiving tokens
    isAddressBlocked(address) {
        return this.blockedAddresses.has(address);
    }

    // Add an address to the blocklist
    addBlockedAddress(address) {
        this.blockedAddresses.add(address);
        console.log(`🚫 Address added to blocklist: ${address}`);
    }

    // Remove an address from the blocklist
    removeBlockedAddress(address) {
        const removed = this.blockedAddresses.delete(address);
        if (removed) {
            console.log(`✅ Address removed from blocklist: ${address}`);
        }
        return removed;
    }

    // Get all blocked addresses
    getBlockedAddresses() {
        return Array.from(this.blockedAddresses);
    }

    // Additional methods can be added here as needed
}

module.exports = TokenService;
