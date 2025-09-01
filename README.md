# OrdiBird Token Game

A fun web-based game where players can earn BIRD tokens on the Bitcoin Spark network.

## 🚀 Quick Start

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn
- A Spark wallet with a mnemonic seed phrase

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/ecurrencyhodler/ordibird
   cd ordibird
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env
   ```
   
   Edit `.env` with your configuration:
   ```env
   # Required: Your Spark wallet mnemonic (12 or 24 words)
   SPARK_MNEMONIC=your_mnemonic_seed_phrase_here_with_spaces
   
   # Network: 'mainnet' for production, 'regtest' for local development
   SPARK_NETWORK=mainnet
   
   # Server configuration
   PORT=3001
   NODE_ENV=production
   
   # Rate limiting
   RATE_LIMIT_WINDOW_MS=86400000
   RATE_LIMIT_MAX_REQUESTS=1
   
   # Token configuration
   TOKEN_NAME=OrdiBird
   TOKEN_TICKER=BIRD
   TOKEN_DECIMALS=6
   TOKEN_MAX_SUPPLY=0n
   TOKEN_IS_FREEZABLE=true
   TOKEN_METADATA_URL=https://github.com/user-attachments/assets/adb6ee5f-5c04-4fed-b338-53fa04e49ac2
   ```

4. **Start the server**
   ```bash
   npm start
   ```

5. **Open the game**
   - Navigate to `http://localhost:3001` in your browser
   - Or use `npx serve -s . -l 8000` to serve the frontend separately

## 🎮 How to Play

1. **Play the Game**: Hit SPACE to flap
2. **Claim Tokens**: When you reach the end, enter your Spark address to claim a BIRD token

## 🔧 Development

### Local Development Setup

For local development with a Spark testnet:

1. **Set network to regtest**
   ```env
   SPARK_NETWORK=regtest
   ```

2. **Start local Spark network** (if available)
   ```bash
   # Follow Spark documentation for local setup
   ```

3. **Deploy test tokens**
   ```bash
   node deploy-bird-token.js
   ```

### Available Scripts

- `node deploy-bird-token.js` - Deploy BIRD token contract
- `node check-balance-with-seed.js <mnemonic>` - Check balance with seed phrase

## 🌐 Mainnet Deployment

### Prerequisites for Mainnet

1. **Real Bitcoin**: You'll need actual Bitcoin to fund the issuer wallet
2. **Secure Environment**: Use production-grade environment variable management

### Mainnet Configuration

1. **Set environment variables**:
   ```env
   SPARK_NETWORK=mainnet
   NODE_ENV=production
   SPARK_MNEMONIC=your_production_mnemonic_here
   ```

2. **Deploy the BIRD token**:
   ```bash
   node deploy-bird-token.js
   ```

3. **Verify deployment**:
   ```bash
   node check-issuer-balance.js
   ```

### Security Considerations

- **Never commit mnemonics to version control**
- **Use secure environment variable management**
- **Backup your issuer wallet mnemonic securely**
- **Monitor the issuer wallet for unauthorized activity**
- **Consider using hardware wallets for production**

## 📁 Project Structure

```
ordibird/
├── deploy-bird-token.js      # Token deployment script
├── services/
│   └── TokenService.js       # Token service logic
├── server.js                 # Express server
├── index.html               # Game frontend
├── script.js                # Game logic
├── style.css                # Game styling
├── token-metadata.json      # Token metadata
└── env.example              # Environment template
```

## 🔒 Security

- All mnemonics are loaded from environment variables
- No hardcoded secrets in the codebase
- Rate limiting prevents abuse
- Address validation ensures proper format

## 📝 License
MIT LicenseCopyright (c) [2025] ecurrencyhodler 

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 🆘 Support

For issues and questions:
- Create an issue in the repository
- Check the Spark documentation
- Ensure your environment variables are properly set