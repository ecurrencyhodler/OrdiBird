#!/usr/bin/env node

/**
 * Check BIRD token balance using seed phrase
 */

require('dotenv').config();
const { SparkWallet } = require('@buildonspark/spark-sdk');

async function checkBalanceWithSeed(seedPhrase) {
    try {
        console.log('🔍 Checking BIRD token balance...');
        console.log('🌱 Using seed phrase to access wallet');
        
        // Initialize wallet with the provided seed phrase
        const { wallet } = await SparkWallet.initialize({
            mnemonicOrSeed: seedPhrase,
            options: {
                network: "MAINNET",
            },
        });

        console.log('✅ Wallet initialized successfully');

        // Get the Spark address
        const sparkAddress = await wallet.getSparkAddress();
        console.log('📍 Spark Address:', sparkAddress);

        // Get the balance (this will show all tokens and sats)
        console.log('\n💰 Checking balance...');
        const balance = await wallet.getBalance();
        console.log('💳 Current Balance:', balance);

        // Check if this address has any BIRD tokens
        // We need to look for our BIRD token identifier
        const birdTokenId = 'btknrt127tjvrk39myktzq5e02mvfa7tsrw0xqwma020f8cpcfk4rnkt2dqpt2h26';
        
        console.log('\n🪙 Looking for BIRD tokens...');
        console.log('🆔 BIRD Token ID:', birdTokenId);
        
        // Check if the balance contains our BIRD token
        if (balance.tokenBalances && balance.tokenBalances.size > 0) {
            console.log('📊 Found tokens in balance:');
            let foundBirdTokens = false;
            
            for (const [tokenId, tokenData] of balance.tokenBalances) {
                console.log(`  Token:`, {
                    tokenIdentifier: tokenId,
                    balance: tokenData.balance.toString(),
                    tokenName: tokenData.tokenMetadata?.tokenName || 'Unknown',
                    tokenTicker: tokenData.tokenMetadata?.tokenTicker || 'Unknown'
                });
                
                if (tokenId === birdTokenId) {
                    foundBirdTokens = true;
                    console.log('🎉 FOUND BIRD TOKENS!');
                    console.log('🪙 BIRD Token Balance:', tokenData.balance.toString(), 'base units');
                    console.log('🪙 BIRD Token Balance:', (Number(tokenData.balance) / 1000000).toFixed(6), 'BIRD tokens');
                }
            }
            
            if (!foundBirdTokens) {
                console.log('❌ No BIRD tokens found in this wallet');
            }
        } else {
            console.log('❌ No tokens found in this wallet');
        }

        return balance;

    } catch (error) {
        console.error('❌ Error checking balance:', error);
        throw error;
    }
}

// Run the script if called directly
if (require.main === module) {
    const seedPhrase = process.argv[2];

    checkBalanceWithSeed(seedPhrase)
        .then((balance) => {
            console.log('\n🎉 Balance check completed!');
            console.log('📊 Summary:', balance);
        })
        .catch((error) => {
            console.error('❌ Balance check failed:', error.message);
            process.exit(1);
        });
}

module.exports = { checkBalanceWithSeed };
