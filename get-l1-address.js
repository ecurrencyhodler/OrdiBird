#!/usr/bin/env node

require('dotenv').config();
const { IssuerSparkWallet } = require('@buildonspark/issuer-sdk');

async function getL1Address() {
    try {
        console.log('🔧 Getting L1 address for BIRD token deployment...');
        console.log('🌐 Network:', process.env.SPARK_NETWORK || 'mainnet');
        
        // Create the Issuer Spark wallet
        const { wallet, mnemonic } = await IssuerSparkWallet.initialize({
            mnemonicOrSeed: process.env.SPARK_MNEMONIC,
            options: {
                network: process.env.SPARK_NETWORK || 'mainnet',
            },
        });
        
        console.log('✅ Issuer Spark wallet initialized');
        
        // Get the L1 address that needs funding
        const l1Address = await wallet.getTokenL1Address();
        console.log('\n📍 FUND THIS L1 ADDRESS:', l1Address);
        console.log('\n💰 Send Bitcoin to this address to fund the BIRD token deployment');
        console.log('📝 This address will be used to announce the BIRD token on the Bitcoin network');
        
        return l1Address;
        
    } catch (error) {
        console.error('❌ Failed to get L1 address:', error.message);
        throw error;
    }
}

if (require.main === module) {
    getL1Address().catch(console.error);
}

module.exports = { getL1Address };

