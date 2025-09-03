const TokenService = require('./services/TokenService');
const balanceCacheService = require('./services/BalanceCacheService');
require('dotenv').config();

async function testCompleteFlowWithCache() {
    try {
        console.log('🧪 Testing Complete Flow: Balance Query → Wait 5s → Token Transfer...\n');
        
        const targetAddress = 'sp1pgss9vxuzvdudz8u0s3lchn04uu3ws7qvxz8y94gdl76hhznldspkkxj557lz6';
        
        // Step 1: Initialize TokenService
        console.log('=== Step 1: Initialize TokenService ===');
        const tokenService = new TokenService();
        await tokenService.initialize();
        console.log('✅ TokenService initialized');
        
        // Step 2: Query initial balance (both issuer wallet and cache)
        console.log('\n=== Step 2: Query Initial Balances ===');
        
        // Get issuer wallet address
        const issuerAddress = await tokenService.getCurrentAddress();
        console.log('📍 Issuer wallet address:', issuerAddress.address);
        
        // Check cache for issuer wallet
        const cachedBalance = balanceCacheService.getCachedBalance(issuerAddress.address);
        console.log('💰 Cached issuer balance:', cachedBalance || 'Not cached');
        
        // Get live balance from TokenService
        const tokenInfo = await tokenService.getTokenInfo();
        console.log('💰 Live issuer token balance:', tokenInfo.balance, 'units');
        
        // Step 3: Wait 5 seconds (simulating your requirement)
        console.log('\n=== Step 3: Wait 5 Seconds ===');
        console.log('⏳ Waiting 5 seconds before attempting transfer...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        console.log('✅ 5 second wait completed');
        
        // Step 4: Attempt direct token transfer (no minting)
        console.log('\n=== Step 4: Attempt Direct Token Transfer ===');
        console.log(`🎯 Attempting to transfer 1 BIRD token to: ${targetAddress}`);
        console.log('📝 Note: Skipping minting step, using existing tokens only');
        
        try {
            // Get the wallet directly for transfer
            const { wallet } = await tokenService.issuerWallet.constructor.initialize({
                mnemonicOrSeed: process.env.SPARK_MNEMONIC,
                options: {
                    network: process.env.SPARK_NETWORK || 'mainnet',
                },
            });
            
            // Get current balance to find token ID
            const currentBalance = await wallet.getBalance();
            let tokenId = null;
            if (currentBalance && currentBalance.tokenBalances) {
                for (const [id, tokenBal] of currentBalance.tokenBalances) {
                    tokenId = id; // Use bech32 format
                    console.log('🆔 Using token ID:', tokenId);
                    console.log('💰 Available balance:', tokenBal.balance.toString(), 'units');
                    break;
                }
            }
            
            if (!tokenId) {
                throw new Error('No tokens found for transfer');
            }
            
            // Direct transfer without minting
            const transferAmount = 1000000n; // 1 token with 6 decimals
            const transferResult = await wallet.transferTokens({
                tokenId: tokenId,
                receiverSparkAddress: targetAddress,
                tokenAmount: transferAmount
            });
            
            const claimResult = {
                txHash: transferResult,
                amount: transferAmount.toString(),
                tokenId: tokenId,
                type: 'direct_transfer'
            };
            console.log('✅ TOKEN TRANSFER SUCCESSFUL!');
            console.log('📝 Transfer result:', JSON.stringify(claimResult, null, 2));
            
            // Step 5: Verify balance cache was scheduled for update
            console.log('\n=== Step 5: Verify Cache Update Scheduled ===');
            const cacheStats = balanceCacheService.getCacheStats();
            console.log('📊 Cache stats after transfer:', cacheStats);
            
            if (cacheStats.pendingUpdates > 0) {
                console.log('✅ Balance cache update was scheduled');
                console.log('⏳ Waiting for cache update to complete (5 seconds)...');
                await new Promise(resolve => setTimeout(resolve, 6000));
                
                // Check updated cache
                const updatedCached = balanceCacheService.getCachedBalance(issuerAddress.address);
                console.log('💰 Updated cached balance:', updatedCached);
            }
            
        } catch (transferError) {
            console.error('❌ TOKEN TRANSFER FAILED!');
            console.error('Error:', transferError.message);
            
            // Let's try to understand why it failed
            console.log('\n=== Debugging Transfer Failure ===');
            
            // Check if it's the same "Insufficient token amount" error
            if (transferError.message.includes('Insufficient token amount')) {
                console.log('🔍 This is the same UTXO selection issue we encountered before');
                console.log('💡 The tokens are visible in balance but not spendable');
                console.log('📝 This suggests a deeper SDK or blockchain state issue');
            }
            
            // Show current balance again
            const currentTokenInfo = await tokenService.getTokenInfo();
            console.log('💰 Current token balance after failed transfer:', currentTokenInfo.balance, 'units');
        }
        
        // Step 6: Final cache statistics
        console.log('\n=== Step 6: Final Cache Statistics ===');
        const finalStats = balanceCacheService.getCacheStats();
        console.log('📊 Final cache stats:', finalStats);
        
        console.log('\n🏁 Complete flow test finished!');
        
    } catch (error) {
        console.error('\n❌ COMPLETE FLOW TEST FAILED!');
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
    }
}

// Run the test
if (require.main === module) {
    testCompleteFlowWithCache();
}

module.exports = { testCompleteFlowWithCache };
