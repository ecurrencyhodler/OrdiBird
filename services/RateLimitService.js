class RateLimitService {
    constructor() {
        // Use in-memory storage for serverless environment
        this.claims = new Map();
        console.log('📝 RateLimitService initialized with in-memory storage (serverless mode)');
    }

    async loadClaims() {
        // No-op for serverless environment - data is ephemeral
        console.log('📝 Serverless mode: Claims are stored in memory only');
    }

    async saveClaims() {
        // No-op for serverless environment - data is ephemeral
        // In a production environment, you would save to a database like Redis, DynamoDB, etc.
        console.log('📝 Serverless mode: Claims saved to memory (ephemeral)');
    }

    hasClaimedToday(sparkAddress) {
        const normalizedAddress = sparkAddress.toLowerCase();
        const claimData = this.claims.get(normalizedAddress);
        
        if (!claimData) {
            return false;
        }

        const lastClaimDate = new Date(claimData.lastClaim);
        const today = new Date();
        
        // Reset time to start of day for comparison
        lastClaimDate.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);
        
        return lastClaimDate.getTime() === today.getTime();
    }

    async recordClaim(sparkAddress) {
        const normalizedAddress = sparkAddress.toLowerCase();
        const now = new Date();
        
        const claimData = {
            address: sparkAddress,
            lastClaim: now.toISOString(),
            claimCount: (this.claims.get(normalizedAddress)?.claimCount || 0) + 1,
            firstClaim: this.claims.get(normalizedAddress)?.firstClaim || now.toISOString()
        };
        
        this.claims.set(normalizedAddress, claimData);
        await this.saveClaims();
        
        console.log(`✅ Recorded claim for ${sparkAddress} (total claims: ${claimData.claimCount})`);
    }

    getNextClaimTime(sparkAddress) {
        const normalizedAddress = sparkAddress.toLowerCase();
        const claimData = this.claims.get(normalizedAddress);
        
        if (!claimData) {
            return null;
        }

        const lastClaimDate = new Date(claimData.lastClaim);
        const nextClaimDate = new Date(lastClaimDate);
        nextClaimDate.setDate(nextClaimDate.getDate() + 1);
        nextClaimDate.setHours(0, 0, 0, 0);
        
        return nextClaimDate.toISOString();
    }

    getClaimStats(sparkAddress) {
        const normalizedAddress = sparkAddress.toLowerCase();
        const claimData = this.claims.get(normalizedAddress);
        
        if (!claimData) {
            return {
                hasClaimed: false,
                claimCount: 0,
                firstClaim: null,
                lastClaim: null,
                nextClaimAvailable: null
            };
        }

        return {
            hasClaimed: this.hasClaimedToday(sparkAddress),
            claimCount: claimData.claimCount,
            firstClaim: claimData.firstClaim,
            lastClaim: claimData.lastClaim,
            nextClaimAvailable: this.getNextClaimTime(sparkAddress)
        };
    }

    getAllClaims() {
        const claims = [];
        for (const [address, data] of this.claims.entries()) {
            claims.push({
                address: data.address,
                claimCount: data.claimCount,
                firstClaim: data.firstClaim,
                lastClaim: data.lastClaim,
                hasClaimedToday: this.hasClaimedToday(data.address)
            });
        }
        return claims;
    }

    getTotalClaims() {
        return this.claims.size;
    }

    getClaimsToday() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        let count = 0;
        for (const [address, data] of this.claims.entries()) {
            const lastClaimDate = new Date(data.lastClaim);
            lastClaimDate.setHours(0, 0, 0, 0);
            
            if (lastClaimDate.getTime() === today.getTime()) {
                count++;
            }
        }
        
        return count;
    }
}

module.exports = RateLimitService;
