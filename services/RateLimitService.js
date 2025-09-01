const fs = require('fs').promises;
const path = require('path');

class RateLimitService {
    constructor() {
        this.dataFile = path.join(__dirname, '..', 'data', 'claims.json');
        this.claims = new Map();
        this.loadClaims();
    }

    async loadClaims() {
        try {
            // Ensure data directory exists
            const dataDir = path.dirname(this.dataFile);
            await fs.mkdir(dataDir, { recursive: true });

            // Try to load existing claims
            const data = await fs.readFile(this.dataFile, 'utf8');
            const claimsData = JSON.parse(data);
            
            // Convert array back to Map
            this.claims = new Map(claimsData);
            console.log(`✅ Loaded ${this.claims.size} existing claims`);
        } catch (error) {
            if (error.code === 'ENOENT') {
                console.log('📝 No existing claims file found, starting fresh');
                this.claims = new Map();
            } else {
                console.error('❌ Error loading claims:', error);
                this.claims = new Map();
            }
        }
    }

    async saveClaims() {
        try {
            // Ensure data directory exists
            const dataDir = path.dirname(this.dataFile);
            await fs.mkdir(dataDir, { recursive: true });

            // Convert Map to array for JSON serialization
            const claimsArray = Array.from(this.claims.entries());
            await fs.writeFile(this.dataFile, JSON.stringify(claimsArray, null, 2));
        } catch (error) {
            console.error('❌ Error saving claims:', error);
            throw error;
        }
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

