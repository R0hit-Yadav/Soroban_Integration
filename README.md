# Soroban Deposit

A full-stack decentralized application for depositing tokens into a Stellar Soroban smart contract.

## 🌟 Features

- **Wallet Integration**: Connect with Freighter browser wallet
- **Real-time Balance**: View your XLM balance instantly
- **Secure Deposits**: Deposit tokens to smart contract with transaction signing
- **Event Tracking**: Smart contract emits events for all operations
- **Responsive UI**: Modern, gradient-styled interface

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Next.js Frontend                          │
│              (React + TypeScript + Tailwind)                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 Stellar SDK + Freighter API                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Stellar Soroban Smart Contract                  │
│                    (Rust/WASM)                               │
└─────────────────────────────────────────────────────────────┘
```

## 📦 Project Structure

```
Soroban_Integration/
├── soroban-hello-world/          # Smart Contract
│   └── contracts/
│       └── hello-world/
│           └── src/
│               ├── lib.rs        # Contract implementation
│               └── test.rs       # Unit tests
│
└── soroban-deposit-dapp/         # Frontend Application
    ├── app/
    │   ├── layout.tsx
    │   └── page.tsx
    └── components/
        └── SorobanDepositApp.tsx # Main component
```

## 🚀 Quick Start

### Prerequisites

- [Rust](https://rustup.rs/) with `wasm32-unknown-unknown` target
- [Node.js](https://nodejs.org/) v18+
- [Freighter Wallet](https://freighter.app/) browser extension
- [Stellar CLI](https://developers.stellar.org/docs/tools/stellar-cli)

### Smart Contract Deployment

```bash
# Build contract
cd soroban-hello-world/contracts/hello-world
cargo build --target wasm32-unknown-unknown --release

# Deploy to testnet
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/hello_world.wasm \
  --source YOUR_SECRET_KEY \
  --network testnet
```

### Frontend Setup

```bash
cd soroban-deposit-dapp
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 🔧 Configuration

Update the contract address in `components/SorobanDepositApp.tsx`:

```typescript
const CONTRACT_ADDRESS = 'YOUR_CONTRACT_ID';
```

## 📋 Smart Contract Functions

| Function | Description |
|----------|-------------|
| `initialize(token)` | Initialize contract with token address |
| `deposit(from, amount)` | Deposit tokens into contract |
| `withdraw(to, amount)` | Withdraw tokens from contract |
| `get_balance(user)` | Get user's deposited balance |
| `get_token()` | Get the token contract address |

## 🔐 Security Features

- **Re-initialization Protection**: Contract can only be initialized once
- **Authorization Checks**: All operations require proper authentication
- **Input Validation**: Amount validation on all transfers
- **Balance Verification**: Checks sufficient funds before withdrawal

## 🌐 Network Configuration

| Parameter | Value |
|-----------|-------|
| Network | Stellar Testnet |
| Soroban RPC | `https://soroban-testnet.stellar.org` |
| Horizon | `https://horizon-testnet.stellar.org` |
| Network Passphrase | `Test SDF Network ; September 2015` |

## 📱 Usage

1. **Install Freighter**: Add the browser extension and create/import a testnet account
2. **Fund Account**: Use [Friendbot](https://laboratory.stellar.org/#account-creator?network=test) to get testnet XLM
3. **Connect Wallet**: Click "Connect Freighter Wallet"
4. **Deposit**: Enter amount and click "Deposit Tokens"
5. **Sign Transaction**: Approve in Freighter popup
6. **Confirmation**: Wait for transaction confirmation

## 🧪 Testing

### Contract Tests
```bash
cd soroban-hello-world/contracts/hello-world
cargo test
```

### Manual Testing
1. Connect wallet
2. Verify balance displays correctly
3. Make small deposit (0.01 XLM)
4. Check transaction on [Stellar Expert](https://stellar.expert/explorer/testnet)

## 🛠️ Tech Stack

### Smart Contract
- **Language**: Rust
- **Framework**: Soroban SDK
- **Target**: WebAssembly (WASM)

### Frontend
- **Framework**: Next.js 16
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Blockchain SDK**: @stellar/stellar-sdk
- **Wallet**: @stellar/freighter-api

---

Built with ❤️ on Stellar Soroban