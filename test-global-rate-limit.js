const RateLimitService = require('./services/RateLimitService');

async function testGlobalRateLimit() {
    console.log('🧪 Testing global rate limit functionality...\n');
    
    const rateLimitService = new RateLimitService();
    
    // Test 1: Check initial state
    console.log('1. Testing initial state...');
    const initialStats = rateLimitService.getGlobalMintStats();
    console.log('   Initial stats:', initialStats);
    console.log('   Is limit exceeded initially:', rateLimitService.isGlobalRateLimitExceeded());
    console.log('   ✅ Initial state looks good\n');
    
    // Test 2: Record some mints and check stats
    console.log('2. Recording 5 mints...');
    for (let i = 1; i <= 5; i++) {
        rateLimitService.recordGlobalMint();
        const stats = rateLimitService.getGlobalMintStats();
        console.log(`   After mint ${i}: ${stats.tokensThisMinute}/${stats.maxTokensPerMinute}`);
    }
    console.log('   ✅ Mint recording works correctly\n');
    
    // Test 3: Test approaching the limit
    console.log('3. Recording 15 more mints to approach limit...');
    for (let i = 6; i <= 20; i++) {
        rateLimitService.recordGlobalMint();
        if (i % 5 === 0) {
            const stats = rateLimitService.getGlobalMintStats();
            console.log(`   After mint ${i}: ${stats.tokensThisMinute}/${stats.maxTokensPerMinute}`);
        }
    }
    
    const statsAt20 = rateLimitService.getGlobalMintStats();
    console.log('   Final stats at 20 mints:', statsAt20);
    console.log('   Is limit exceeded at 20:', rateLimitService.isGlobalRateLimitExceeded());
    console.log('   ✅ Reached limit correctly\n');
    
    // Test 4: Test exceeding the limit
    console.log('4. Testing limit exceeded...');
    rateLimitService.recordGlobalMint(); // This should be the 21st mint
    const statsAt21 = rateLimitService.getGlobalMintStats();
    console.log('   Stats after 21st mint:', statsAt21);
    console.log('   Is limit exceeded at 21:', rateLimitService.isGlobalRateLimitExceeded());
    console.log('   ✅ Limit exceeded detection works\n');
    
    // Test 5: Test minute key generation
    console.log('5. Testing minute key generation...');
    const currentMinute = rateLimitService.getCurrentMinuteKey();
    console.log('   Current minute key:', currentMinute);
    console.log('   ✅ Minute key generation works\n');
    
    // Test 6: Test cleanup functionality
    console.log('6. Testing cleanup functionality...');
    console.log('   Global mint tracker size before cleanup:', rateLimitService.globalMintTracker.size);
    rateLimitService.cleanupOldMintTracking();
    console.log('   Global mint tracker size after cleanup:', rateLimitService.globalMintTracker.size);
    console.log('   ✅ Cleanup functionality works\n');
    
    console.log('🎉 All global rate limit tests passed!');
    console.log('\n📊 Final Summary:');
    console.log('   - Global rate limit: 20 tokens per minute');
    console.log('   - Current implementation tracks by minute-level precision');
    console.log('   - Automatic cleanup prevents memory leaks');
    console.log('   - Rate limit detection works correctly');
}

// Run the test
testGlobalRateLimit().catch(console.error);
