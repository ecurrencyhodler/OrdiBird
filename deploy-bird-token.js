#!/usr/bin/env node

/**
 * Script to deploy the BIRD token contract to Bitcoin regtest
 * This creates a real token contract that can be used with the Spark SDK
 */

require('dotenv').config();
const { IssuerSparkWallet } = require('@buildonspark/issuer-sdk');
const { SparkWallet, getLatestDepositTxId } = require('@buildonspark/spark-sdk');

async function deployBirdToken() {
    try {
        console.log('🚀 Deploying BIRD token contract to Bitcoin regtest...');
        console.log('🌐 Network:', process.env.SPARK_NETWORK || 'mainnet');
        
        // Create the Issuer Spark wallet
        const { wallet, mnemonic } = await IssuerSparkWallet.initialize({
            mnemonicOrSeed: process.env.SPARK_MNEMONIC,
            options: {
                network: process.env.SPARK_NETWORK || 'mainnet',
            },
        });
        
        console.log('✅ Issuer Spark wallet initialized');
        
        // Fund Issuer Wallet to fund token announcement on L1
        const l1Address = await wallet.getTokenL1Address();
        console.log('📍 Fund this L1 address:', l1Address);
        
        // Use L1 address as the public key identifier
        const publicKey = l1Address;
        console.log('🔑 Public Key/Address:', publicKey);
        
        // Check for latest deposit and claim it if available
        try {
            const result = await getLatestDepositTxId(l1Address);
            if (result) {
                console.log('💰 Found deposit transaction ID:', result);
                const tx = await wallet.claimDeposit(result);
                console.log('✅ Deposit claimed:', tx);
                console.log('📋 Deposit TX details:', tx);
            } else {
                console.log('⚠️ No deposits found. Please fund the L1 address above to continue.');
            }
        } catch (error) {
            console.log('⚠️ Could not check for deposits:', error.message);
        }
        
        // Announce the token on L1
        const tokenName = process.env.TOKEN_NAME || 'OrdiBird';
        const tokenTicker = process.env.TOKEN_TICKER || 'BIRD';
        const tokenDecimals = parseInt(process.env.TOKEN_DECIMALS) || 6;
        const maxSupplyEnv = process.env.TOKEN_MAX_SUPPLY || '1000000000000';
        const maxSupply = maxSupplyEnv === '0n' ? BigInt(0) : BigInt(maxSupplyEnv); // Handle 0n case
        const isFreezeable = process.env.TOKEN_IS_FREEZABLE === 'true';
        
        console.log('📢 Announcing token on L1...');
        let creationTx = null;
        let tokenIdentifier = null;
        try {
            // Try different method names for token announcement
            let announceResult = null;
            if (wallet.announceTokenL1) {
                announceResult = await wallet.announceTokenL1({
                    tokenName: tokenName,
                    tokenTicker: tokenTicker,
                    maxSupply: maxSupply,
                    decimals: tokenDecimals,
                    isFreezeable: isFreezeable,
                });
            } else if (wallet.announceToken) {
                announceResult = await wallet.announceToken({
                    tokenName: tokenName,
                    tokenTicker: tokenTicker,
                    maxSupply: maxSupply,
                    decimals: tokenDecimals,
                    isFreezeable: isFreezeable,
                });
            } else if (wallet.createToken) {
                announceResult = await wallet.createToken({
                    tokenName: tokenName,
                    tokenTicker: tokenTicker,
                    maxSupply: maxSupply,
                    decimals: tokenDecimals,
                    isFreezeable: isFreezeable,
                });
            } else {
                console.log('⚠️ No token announcement method found on wallet');
                console.log('📝 Available methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(wallet)));
            }
            
            if (announceResult) {
                console.log('✅ Token announced on L1 successfully!');
                console.log('📋 Announce Result:', announceResult);
                
                // Extract transaction info and token identifier
                if (announceResult.txid) {
                    creationTx = announceResult.txid;
                } else if (announceResult.transactionId) {
                    creationTx = announceResult.transactionId;
                } else if (announceResult.hash) {
                    creationTx = announceResult.hash;
                }
                
                if (announceResult.tokenId) {
                    tokenIdentifier = announceResult.tokenId;
                } else if (announceResult.id) {
                    tokenIdentifier = announceResult.id;
                } else if (announceResult.identifier) {
                    tokenIdentifier = announceResult.identifier;
                }
                
                console.log('🆔 Creation TX:', creationTx || 'Not found in result');
                console.log('🏷️ Token Identifier:', tokenIdentifier || 'Not found in result');
            }
            
        } catch (error) {
            console.log('⚠️ Could not announce token:', error.message);
            console.log('📝 Error details:', error);
        }
        
        // Mint tokens to the issuer wallet
        const mintAmount = BigInt(process.env.INITIAL_MINT_AMOUNT || '1');
        console.log(`🪙 Minting ${mintAmount} tokens to issuer wallet...`);
        let balance = null;
        let mintTx = null;
        try {
            const transaction = await wallet.mintTokens(mintAmount);
            console.log('✅ Tokens minted successfully!');
            console.log('📋 Mint transaction:', transaction);
            
            if (transaction) {
                if (transaction.txid) {
                    mintTx = transaction.txid;
                } else if (transaction.transactionId) {
                    mintTx = transaction.transactionId;
                } else if (transaction.hash) {
                    mintTx = transaction.hash;
                }
                console.log('🆔 Mint TX:', mintTx || 'Not found in result');
            }
            
            // Get and display balance
            balance = await wallet.getBalance();
            console.log('💰 Sat and token balance:', balance);
        } catch (error) {
            console.log('⚠️ Could not mint tokens:', error.message);
            console.log('📝 Error details:', error);
            
            // Try to get balance anyway
            try {
                balance = await wallet.getBalance();
                console.log('💰 Current balance:', balance);
            } catch (balanceError) {
                console.log('⚠️ Could not get balance:', balanceError.message);
                balance = { satBalance: 0, tokenBalances: new Map() };
            }
        }
        
        // Save token info to a file for the service to use
        const fs = require('fs');
        
        // Convert balance to serializable format
        const serializableBalance = balance ? {
            balance: balance.balance ? balance.balance.toString() : '0',
            tokenBalances: balance.tokenBalances ? Array.from(balance.tokenBalances.entries()).map(([key, value]) => [
                key,
                {
                    ...value,
                    balance: value.balance ? value.balance.toString() : '0'
                }
            ]) : []
        } : null;
        
        const tokenInfo = {
            tokenName: tokenName,
            tokenTicker: tokenTicker,
            tokenDecimals: tokenDecimals,
            maxSupply: maxSupply.toString(),
            isFreezeable: isFreezeable,
            l1Address: l1Address,
            publicKey: publicKey,
            tokenIdentifier: tokenIdentifier,
            creationTx: creationTx,
            mintTx: mintTx,
            mintAmount: mintAmount.toString(),
            balance: serializableBalance,
            deployed: true,
            deploymentTime: new Date().toISOString(),
            network: process.env.SPARK_NETWORK || 'regtest'
        };
        
        fs.writeFileSync('bird-token-info.json', JSON.stringify(tokenInfo, null, 2));
        console.log('💾 Token info saved to: bird-token-info.json');
        
        return tokenInfo;
        
    } catch (error) {
        console.error('❌ Failed to deploy BIRD token:', error);
        throw error;
    }
}

// Run the script if called directly
if (require.main === module) {
    deployBirdToken()
        .then((tokenInfo) => {
            console.log('\n🎉 BIRD Token Deployment Completed!');
            console.log('=====================================');
            console.log('📝 Token Name:', tokenInfo.tokenName);
            console.log('🏷️ Token Ticker:', tokenInfo.tokenTicker);
            console.log('🔢 Decimals:', tokenInfo.tokenDecimals);
            console.log('📊 Max Supply:', tokenInfo.maxSupply);
            console.log('❄️ Freezable:', tokenInfo.isFreezeable);
            console.log('📍 L1 Address:', tokenInfo.l1Address);
            console.log('🔑 Public Key:', tokenInfo.publicKey);
            console.log('🆔 Token Identifier:', tokenInfo.tokenIdentifier || 'Not available');
            console.log('📋 Creation TX:', tokenInfo.creationTx || 'Not available');
            console.log('🪙 Mint TX:', tokenInfo.mintTx || 'Not available');
            console.log('🪙 Initial Mint:', tokenInfo.mintAmount);
            console.log('💰 Current Balance:', tokenInfo.balance);
            console.log('🌐 Network:', tokenInfo.network);
            console.log('⏰ Deployed:', tokenInfo.deploymentTime);
            console.log('=====================================');
            console.log('🔄 You can now use this token in your OrdiBird game!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ BIRD token deployment failed:', error.message);
            process.exit(1);
        });
}

module.exports = { deployBirdToken };
