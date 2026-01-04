'use client';
import React, { useState, useEffect } from 'react';
import { AlertCircle, Wallet, Send, RefreshCw, CheckCircle, XCircle, Link } from 'lucide-react';
import { requestAccess, getAddress, signTransaction } from '@stellar/freighter-api';
import * as StellarSdk from '@stellar/stellar-sdk';

// Constants
const CONTRACT_ADDRESS = 'CDFBALTD7L6ZX4VUJ5NVQNUXJNGAVLUIY7IUY52OME3QXLWQUVGHWOHV';
const NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015';
const SOROBAN_RPC_URL = 'https://soroban-testnet.stellar.org';
const HORIZON_URL = 'https://horizon-testnet.stellar.org';

interface Message {
  type: 'success' | 'error' | 'info' | '';
  text: string;
}

const SorobanDepositApp: React.FC = () => {
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [depositAmount, setDepositAmount] = useState<string>('');
  const [balance, setBalance] = useState<string>('0');
  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<Message>({ type: '', text: '' });

  useEffect(() => {
    checkWalletConnection();
    
    const handleFocus = () => checkWalletConnection();
    window.addEventListener('focus', handleFocus);
    
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const checkWalletConnection = async (): Promise<void> => {
    try {
      const result = await getAddress();
      if (result.address && !result.error) {
        setWalletAddress(result.address);
        setIsConnected(true);
        await fetchBalance(result.address);
      }
    } catch (error) {
      // Silent fail on auto-check
      console.log('Wallet not connected');
    }
  };

  const connectWallet = async (): Promise<void> => {
    try {
      setLoading(true);
      
      const accessGranted = await requestAccess();
      if (!accessGranted) {
        throw new Error('Please approve the connection in Freighter');
      }
      
      const result = await getAddress();
      if (result.error) throw new Error(result.error);
      if (!result.address) throw new Error('Wallet is locked. Please unlock Freighter');
      
      setWalletAddress(result.address);
      setIsConnected(true);
      await fetchBalance(result.address);
      
      showMessage('success', 'Wallet connected successfully!');
    } catch (error: any) {
      showMessage('error', error?.message || 'Failed to connect wallet');
    } finally {
      setLoading(false);
    }
  };

  const fetchBalance = async (address: string): Promise<void> => {
    try {
      const server = new StellarSdk.Horizon.Server(HORIZON_URL);
      const account = await server.loadAccount(address);
      
      const xlmBalance = account.balances.find(
        (balance: any) => balance.asset_type === 'native'
      );
      
      setBalance(xlmBalance ? parseFloat(xlmBalance.balance).toFixed(2) : '0');
    } catch (error: any) {
      if (error?.response?.status === 404) {
        setBalance('0 (Not funded)');
      } else {
        setBalance('Error');
      }
    }
  };

  const handleDeposit = async (): Promise<void> => {
    const amount = parseFloat(depositAmount);
    
    if (!amount || amount <= 0) {
      showMessage('error', 'Please enter a valid amount');
      return;
    }

    if (!isConnected) {
      showMessage('error', 'Please connect your wallet first');
      return;
    }

    try {
      setLoading(true);
      showMessage('info', 'Building transaction...');

      const server = new StellarSdk.rpc.Server(SOROBAN_RPC_URL);
      const sourceAccount = await server.getAccount(walletAddress);
      const contract = new StellarSdk.Contract(CONTRACT_ADDRESS);
      
      // Convert XLM to stroops (1 XLM = 10,000,000 stroops)
      const amountInStroops = Math.floor(amount * 10_000_000);
      
      const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(
          contract.call(
            'deposit',
            StellarSdk.nativeToScVal(walletAddress, { type: 'address' }),
            StellarSdk.nativeToScVal(amountInStroops, { type: 'i128' })
          )
        )
        .setTimeout(30)
        .build();

      showMessage('info', 'Preparing transaction...');
      const preparedTx = await server.prepareTransaction(transaction);

      showMessage('info', 'Please sign in Freighter...');
      const signResult = await signTransaction(preparedTx.toXDR(), {
        networkPassphrase: NETWORK_PASSPHRASE,
      });

      showMessage('info', 'Submitting transaction...');
      const signedTx = StellarSdk.TransactionBuilder.fromXDR(
        signResult.signedTxXdr,
        NETWORK_PASSPHRASE
      );

      const result = await server.sendTransaction(signedTx as StellarSdk.Transaction);

      if (result.status === 'PENDING') {
        showMessage('info', 'Waiting for confirmation...');
        await pollTransactionStatus(server, result.hash);
        
        showMessage('success', `Successfully deposited ${amount} XLM!`);
        await fetchBalance(walletAddress);
        setDepositAmount('');
      } else {
        throw new Error('Transaction rejected by network');
      }
    } catch (error: any) {
      console.error('Deposit error:', error);
      
      if (error?.message?.includes('user')) {
        showMessage('error', 'Transaction rejected');
      } else {
        showMessage('error', error?.message || 'Transaction failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const pollTransactionStatus = async (
    server: StellarSdk.rpc.Server,
    hash: string,
    maxAttempts = 20
  ): Promise<void> => {
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const txResult = await server.getTransaction(hash);
      
      if (txResult.status === 'SUCCESS') return;
      if (txResult.status === 'FAILED') {
        throw new Error('Transaction failed on network');
      }
    }
    throw new Error('Transaction timeout');
  };

  const showMessage = (type: Message['type'], text: string, duration = 3000): void => {
    setMessage({ type, text });
    if (type !== 'info') {
      setTimeout(() => setMessage({ type: '', text: '' }), duration);
    }
  };

  const shortenAddress = (address: string): string => {
    return address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-black flex items-center justify-center p-1">
      <div className="max-w-md w-full bg-gray-900 rounded-2xl shadow-2xl border border-gray-800 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-6">
          <h1 className="text-3xl font-bold text-white text-center">
            Soroban Deposit
          </h1>
          <p className="text-blue-100 text-center mt-2 text-sm">
            Deposit tokens to smart contract
          </p>
        </div>

        {/* Message Banner */}
        {message.text && (
          <div className={`p-4 ${
            message.type === 'success' ? 'bg-green-900/50 border-green-500' :
            message.type === 'error' ? 'bg-red-900/50 border-red-500' :
            'bg-blue-900/50 border-blue-500'
          } border-l-4 flex items-start gap-3`}>
            {message.type === 'success' && <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />}
            {message.type === 'error' && <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />}
            {message.type === 'info' && <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />}
            <p className="text-white text-sm">{message.text}</p>
          </div>
        )}

        {/* Main Content */}
        <div className="p-6 space-y-6">
          {/* Wallet Connection */}
          {!isConnected ? (
            <button
              onClick={connectWallet}
              disabled={loading}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-4 rounded-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Wallet className="w-5 h-5" />
              {loading ? 'Connecting...' : 'Connect Freighter Wallet'}
            </button>
          ) : (
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-sm">Connected Wallet</span>
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              </div>
              <p className="text-white font-mono text-sm">{shortenAddress(walletAddress)}</p>
            </div>
          )}

          {/* Balance Display */}
          {isConnected && (
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-sm">Your Balance</span>
                <button
                  onClick={() => fetchBalance(walletAddress)}
                  className="text-blue-400 hover:text-blue-300 transition-colors"
                  title="Refresh balance"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
              <p className="text-white text-2xl font-bold mt-2">{balance} XLM</p>
            </div>
          )}

          {/* Deposit Form */}
          {isConnected && (
            <div className="space-y-4">
              <div>
                <label className="block text-gray-400 text-sm mb-2">
                  Deposit Amount
                </label>
                <input
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  disabled={loading}
                  min="0"
                  step="0.01"
                />
              </div>

              <button
                onClick={handleDeposit}
                disabled={loading || !depositAmount}
                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold py-4 rounded-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-5 h-5" />
                {loading ? 'Processing...' : 'Deposit Tokens'}
              </button>
            </div>
          )}

          {/* Contract Info */}
          <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
            <p className="text-gray-400 text-xs mb-2">Contract Address</p>
            <p className="text-gray-300 text-xs font-mono break-all">{CONTRACT_ADDRESS}</p>
            <p className="text-blue-300 text-xs font-mono break-all"><a href={`https://stellar.expert/explorer/testnet/contract/${CONTRACT_ADDRESS}`} target="_blank" rel="noopener noreferrer">Click to view on Stellar Expert</a></p>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-800 border-t border-gray-700 p-4 text-center">
          <p className="text-gray-500 text-xs">
            Powered by Stellar Soroban • Testnet
          </p>
        </div>
      </div>
    </div>
  );
};

export default SorobanDepositApp;