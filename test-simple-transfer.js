const { IssuerSparkWallet } = require('@buildonspark/issuer-sdk');
require('dotenv').config();

async function testSimpleTransfer() {
    try {
        console.log('🧪 Testing Simple Token Transfer (No Minting, No Balance Checking)...\n');
        
        const targetAddress = 'sp1pgss9vxuzvdudz8u0s3lchn04uu3ws7qvxz8y94gdl76hhznldspkkxj557lz6';
        
        // Step 1: Initialize Spark Wallet
        console.log('=== Step 1: Initialize Spark Wallet ===');
        const { wallet } = await IssuerSparkWallet.initialize({
            mnemonicOrSeed: process.env.SPARK_MNEMONIC,
            options: {
                network: process.env.SPARK_NETWORK || 'mainnet',
            },
        });
        console.log('✅ Spark wallet initialized');
        
        // Step 2: Get Token ID from environment
        console.log('\n=== Step 2: Get Token ID ===');
        const tokenId = process.env.TOKEN_ID;
        
        if (!tokenId) {
            throw new Error('TOKEN_ID not found in environment variables. Please set TOKEN_ID in your .env file.');
        }
        
        console.log('🆔 Using token ID from environment:', tokenId);
        
        // Step 3: Attempt Direct Token Transfer (no minting, no balance checking)
        console.log('\n=== Step 3: Direct Token Transfer ===');
        console.log(`🎯 Attempting to transfer 1 BIRD token to: ${targetAddress}`);
        console.log('📝 Note: Using existing tokens only, no minting or balance checking');
        
        try {
            // Direct transfer using existing tokens
            const transferAmount = 1000000n; // 1 token with 6 decimals
            console.log(`🔄 Transferring ${transferAmount} units...`);
            
            const transferResult = await wallet.transferTokens({
                tokenIdentifier: tokenId,
                receiverSparkAddress: targetAddress,
                tokenAmount: transferAmount
            });
            
            const result = {
                txHash: transferResult,
                amount: transferAmount.toString(),
                tokenId: tokenId,
                type: 'direct_transfer',
                timestamp: new Date().toISOString()
            };
            
            console.log('✅ TOKEN TRANSFER SUCCESSFUL!');
            console.log('📝 Transfer result:', JSON.stringify(result, null, 2));
            
        } catch (transferError) {
            console.error('❌ TOKEN TRANSFER FAILED!');
            console.error('Error:', transferError.message);
            console.error('Stack:', transferError.stack);
            
            // Provide debugging information
            console.log('\n=== Debugging Information ===');
            console.log('🔍 Error Analysis:');
            
            if (transferError.message.includes('Insufficient token amount')) {
                console.log('💡 This suggests there are not enough spendable tokens in the wallet');
                console.log('📝 The wallet may need tokens to be minted first, or existing tokens may be locked');
            } else if (transferError.message.includes('Invalid token identifier')) {
                console.log('💡 The token identifier may be incorrect or the token may not exist');
                console.log('📝 Check that TOKEN_ID in .env matches your deployed token');
            } else if (transferError.message.includes('Invalid address')) {
                console.log('💡 The receiver address may be invalid');
                console.log('📝 Check that the target address is a valid Spark address');
            } else {
                console.log('💡 Unknown error - check the error message above for details');
            }
            
            throw transferError;
        }
        
        console.log('\n🏁 Simple transfer test completed successfully!');
        
    } catch (error) {
        console.error('\n❌ SIMPLE TRANSFER TEST FAILED!');
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

// Run the test
if (require.main === module) {
    testSimpleTransfer();
}

module.exports = { testSimpleTransfer };
