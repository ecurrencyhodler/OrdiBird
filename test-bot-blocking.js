const axios = require('axios');

// Configuration
const BASE_URL = process.env.TEST_URL || 'http://localhost:3001';
const ADMIN_SECRET = process.env.ADMIN_SECRET;

// Test scenarios
const testScenarios = [
    {
        name: 'Normal Browser Request',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate, br',
            'Referer': 'https://google.com'
        },
        expectedBlocked: false,
        description: 'Should pass - normal browser headers'
    },
    {
        name: 'Bot User Agent - curl',
        headers: {
            'User-Agent': 'curl/7.68.0',
            'Accept': '*/*'
        },
        expectedBlocked: true,
        description: 'Should be blocked - curl user agent'
    },
    {
        name: 'Bot User Agent - python-requests',
        headers: {
            'User-Agent': 'python-requests/2.25.1',
            'Accept': '*/*'
        },
        expectedBlocked: true,
        description: 'Should be blocked - python-requests user agent'
    },
    {
        name: 'Empty User Agent',
        headers: {
            'Accept': '*/*'
        },
        expectedBlocked: true,
        description: 'Should be blocked - missing user agent'
    },
    {
        name: 'Suspicious Headers',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': '*/*'
            // Missing Accept-Language and Accept-Encoding
        },
        expectedBlocked: true,
        description: 'Should be blocked - missing common browser headers'
    },
    {
        name: 'Postman Request',
        headers: {
            'User-Agent': 'PostmanRuntime/7.28.4',
            'Accept': '*/*'
        },
        expectedBlocked: true,
        description: 'Should be blocked - Postman user agent'
    }
];

// Rate limiting test
async function testRateLimit() {
    console.log('\n🚀 Testing Rate Limiting...');
    
    const normalHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': 'https://google.com'
    };

    let blockedCount = 0;
    let successCount = 0;

    for (let i = 1; i <= 15; i++) {
        try {
            const response = await axios.get(`${BASE_URL}/api/turnstile/sitekey`, {
                headers: normalHeaders,
                timeout: 5000
            });
            
            if (response.status === 200) {
                successCount++;
                console.log(`✅ Request ${i}: Success`);
            }
        } catch (error) {
            if (error.response && error.response.status === 429) {
                blockedCount++;
                console.log(`🚫 Request ${i}: Rate limited (${error.response.data.ruleTriggered})`);
                console.log(`   Retry after: ${error.response.data.retryAfter} seconds`);
                break; // Stop after first rate limit hit
            } else {
                console.log(`❌ Request ${i}: Error - ${error.message}`);
            }
        }
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`📊 Rate Limit Test Results:`);
    console.log(`   Successful requests: ${successCount}`);
    console.log(`   Blocked requests: ${blockedCount}`);
    
    return { successCount, blockedCount };
}

// Test individual scenarios
async function testScenario(scenario) {
    console.log(`\n🧪 Testing: ${scenario.name}`);
    console.log(`   Description: ${scenario.description}`);
    
    try {
        const response = await axios.get(`${BASE_URL}/api/turnstile/sitekey`, {
            headers: scenario.headers,
            timeout: 5000
        });
        
        const wasBlocked = false;
        const passed = wasBlocked === scenario.expectedBlocked;
        
        console.log(`   Result: ${passed ? '✅ PASS' : '❌ FAIL'} - Request succeeded (not blocked)`);
        
        return { passed, wasBlocked, response: response.data };
        
    } catch (error) {
        const wasBlocked = error.response && error.response.status === 429;
        const passed = wasBlocked === scenario.expectedBlocked;
        
        if (wasBlocked) {
            console.log(`   Result: ${passed ? '✅ PASS' : '❌ FAIL'} - Request blocked`);
            console.log(`   Block reason: ${error.response.data.error}`);
            console.log(`   Rule triggered: ${error.response.data.ruleTriggered}`);
        } else {
            console.log(`   Result: ${passed ? '✅ PASS' : '❌ FAIL'} - Unexpected error: ${error.message}`);
        }
        
        return { passed, wasBlocked, error: error.response?.data || error.message };
    }
}

// Get security statistics
async function getSecurityStats() {
    try {
        const response = await axios.get(`${BASE_URL}/api/security/stats`, {
            headers: {
                'Authorization': `Bearer ${ADMIN_SECRET}`
            },
            timeout: 5000
        });
        
        return response.data.data;
    } catch (error) {
        console.log(`❌ Failed to get security stats: ${error.message}`);
        return null;
    }
}

// Main test function
async function runTests() {
    console.log('🛡️ Bot Blocking System Test Suite');
    console.log('=====================================');
    console.log(`Testing against: ${BASE_URL}`);
    
    let totalTests = 0;
    let passedTests = 0;
    
    // Test individual scenarios
    console.log('\n📋 Testing Bot Detection Scenarios...');
    for (const scenario of testScenarios) {
        const result = await testScenario(scenario);
        totalTests++;
        if (result.passed) passedTests++;
        
        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Test rate limiting
    console.log('\n📋 Testing Rate Limiting...');
    const rateLimitResult = await testRateLimit();
    totalTests++;
    if (rateLimitResult.blockedCount > 0) {
        passedTests++;
        console.log('✅ Rate limiting test PASSED');
    } else {
        console.log('❌ Rate limiting test FAILED - no requests were blocked');
    }
    
    // Get final statistics
    console.log('\n📊 Security Statistics...');
    const stats = await getSecurityStats();
    if (stats) {
        console.log(`   Active blocked IPs: ${stats.activeBlocks}`);
        console.log(`   Suspicious IPs: ${stats.suspiciousIPs.length}`);
        console.log(`   Total tracked IPs: ${stats.totalTrackedIPs}`);
        console.log(`   Configuration:`);
        console.log(`     - Max requests per window: ${stats.config.maxRequestsPerWindow}`);
        console.log(`     - Time window: ${stats.config.timeWindowSeconds} seconds`);
        console.log(`     - Block duration: ${stats.config.blockDurationMinutes} minutes`);
        
        if (stats.activeBlockedIPs.length > 0) {
            console.log(`   Currently blocked IPs:`);
            stats.activeBlockedIPs.forEach(block => {
                console.log(`     - ${block.ip}: ${block.reason} (${Math.ceil(block.remainingTime/60)} min remaining)`);
            });
        }
    }
    
    // Final summary
    console.log('\n🎯 Test Summary');
    console.log('================');
    console.log(`Total tests: ${totalTests}`);
    console.log(`Passed: ${passedTests}`);
    console.log(`Failed: ${totalTests - passedTests}`);
    console.log(`Success rate: ${Math.round((passedTests / totalTests) * 100)}%`);
    
    if (passedTests === totalTests) {
        console.log('\n🎉 All tests passed! Bot blocking system is working correctly.');
    } else {
        console.log('\n⚠️ Some tests failed. Please review the results above.');
    }
}

// Run tests if this script is executed directly
if (require.main === module) {
    runTests().catch(error => {
        console.error('❌ Test suite failed:', error.message);
        process.exit(1);
    });
}

module.exports = { runTests, testScenarios, getSecurityStats };
