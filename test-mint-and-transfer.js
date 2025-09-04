const { IssuerSparkWallet } = require('@buildonspark/issuer-sdk');
require('dotenv').config();

async function testMintAndTransfer() {
    try {
        console.log('🧪 Testing mint-and-transfer (like original deployment)...');
        
        // Initialize wallet
        const { wallet } = await IssuerSparkWallet.initialize({
            mnemonicOrSeed: process.env.SPARK_MNEMONIC,
            options: {
                network: process.env.SPARK_NETWORK || 'mainnet',
            },
        });
        
        console.log('✅ Wallet initialized');
        
        // Step 1: Mint new tokens (like deployment did)
        const mintAmount = 1000000n; // 1 token with 6 decimals
        console.log(`🪙 Step 1: Minting ${mintAmount} units (like deployment)...`);
        
        const mintResult = await wallet.mintTokens(mintAmount);
        console.log('✅ Mint result:', mintResult);
        
        // Wait for mint to process
        console.log('⏳ Waiting for mint to process...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Step 2: Get balance to see the newly minted tokens
        const balance = await wallet.getBalance();
        console.log('💰 Balance after mint:', balance);
        
        // Step 3: Transfer the newly minted tokens
        const testSparkAddress = 'sp1pgss9vxuzvdudz8u0s3lchn04uu3ws7qvxz8y94gdl76hhznldspkkxj557lz6';
        
        // Get the token ID from the balance (should be the same as before)
        let tokenId = null;
        if (balance && balance.tokenBalances) {
            for (const [id, tokenBalance] of balance.tokenBalances) {
                tokenId = id; // Use bech32 format key
                console.log('🆔 Using token ID for transfer:', tokenId);
                break;
            }
        }
        
        if (!tokenId) {
            throw new Error('No token ID found after minting');
        }
        
        console.log(`🔄 Step 2: Transferring ${mintAmount} units to: ${testSparkAddress}`);
        
        const transferResult = await wallet.transferTokens({
            tokenId: tokenId,
            receiverSparkAddress: testSparkAddress,
            tokenAmount: mintAmount
        });
        
        console.log('\n✅ MINT-AND-TRANSFER TEST SUCCESSFUL!');
        console.log('📝 Transfer result:', transferResult);
        
