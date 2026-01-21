'use client';
import React, { useState, useEffect } from 'react';
import { AlertCircle, Wallet, Send, RefreshCw, CheckCircle, XCircle, Link, Inbox } from 'lucide-react';
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
  const [withdrawAmount, setWithdrawAmount] = useState<string>('');
  const [balance, setBalance] = useState<string>('0');
  const [depositedBalance, setDepositedBalance] = useState<string>('0');
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
        await fetchDepositedBalance(result.address);
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
      await fetchDepositedBalance(result.address);
      
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

  const fetchDepositedBalance = async (address: string): Promise<void> => {
    try {
      const server = new StellarSdk.rpc.Server(SOROBAN_RPC_URL);
      const sourceAccount = await server.getAccount(address);
      const contract = new StellarSdk.Contract(CONTRACT_ADDRESS);
      
      // Build transaction to call get_balance
      const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(
          contract.call(
            'get_balance',
            StellarSdk.nativeToScVal(address, { type: 'address' })
          )
        )
        .setTimeout(30)
        .build();

      // Simulate the transaction to get the balance
      const simulationResponse = await server.simulateTransaction(transaction);
      
      if (StellarSdk.rpc.Api.isSimulationSuccess(simulationResponse)) {
        const result = simulationResponse.result;
        if (result && result.retval) {
          // Convert ScVal to native value (balance is in stroops)
          const balanceInStroops = StellarSdk.scValToNative(result.retval);
          const balanceInXLM = Number(balanceInStroops) / 10_000_000;
          setDepositedBalance(balanceInXLM.toFixed(7));
        } else {
          setDepositedBalance('0');
        }
      } else {
        setDepositedBalance('0');
      }
    } catch (error: any) {
      console.error('Error fetching deposited balance:', error);
      setDepositedBalance('Error');
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
        await fetchDepositedBalance(walletAddress);
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

  const handleWithdraw = async (): Promise<void> => {
    const amount = parseFloat(withdrawAmount);
    
    if (!amount || amount <= 0) {
      showMessage('error', 'Please enter a valid amount');
      return;
    }

    if (!isConnected) {
      showMessage('error', 'Please connect your wallet first');
      return;
    }

    const depositedAmount = parseFloat(depositedBalance);
    if (amount > depositedAmount) {
      showMessage('error', 'Cannot withdraw more than deposited balance');
      return;
    }

    try {
      setLoading(true);
      showMessage('info', 'Building withdrawal transaction...');

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
            'withdraw',
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
        
        showMessage('success', `Successfully withdrew ${amount} XLM!`);
        await fetchBalance(walletAddress);
        await fetchDepositedBalance(walletAddress);
        setWithdrawAmount('');
      } else {
        throw new Error('Transaction rejected by network');
      }
    } catch (error: any) {
      console.error('Withdraw error:', error);
      
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
    <div className="h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-black flex items-center justify-center p-2">
      <div className="w-full max-w-sm bg-gray-900 rounded-xl shadow-2xl border border-gray-800 overflow-hidden flex flex-col h-[95vh] max-h-[700px]">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-3 flex-shrink-0">
          <h1 className="text-xl font-bold text-white text-center">
            Soroban Deposit DApp
          </h1>
          <p className="text-blue-100 text-center mt-1 text-xs">
            Manage your XLM tokens
          </p>
        </div>

        {/* Message Banner */}
        {message.text && (
          <div className={`px-3 py-2 flex-shrink-0 ${
            message.type === 'success' ? 'bg-green-900/50 border-green-500' :
            message.type === 'error' ? 'bg-red-900/50 border-red-500' :
            'bg-blue-900/50 border-blue-500'
          } border-l-4 flex items-start gap-2`}>
            {message.type === 'success' && <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />}
            {message.type === 'error' && <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />}
            {message.type === 'info' && <AlertCircle className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />}
            <p className="text-white text-xs">{message.text}</p>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto px-3 py-8 space-y-5">
          {/* Wallet Connection */}
          {!isConnected ? (
            <button
              onClick={connectWallet}
              disabled={loading}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              <Wallet className="w-4 h-4" />
              {loading ? 'Connecting...' : 'Connect Wallet'}
            </button>
          ) : (
            <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
              <div className="flex items-center justify-between mb-1">
                <span className="text-gray-400 text-xs">Connected</span>
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              </div>
              <p className="text-white font-mono text-xs">{shortenAddress(walletAddress)}</p>
            </div>
          )}

          {/* Balance Display */}
          {isConnected && (
            <div className="grid grid-cols-2 gap-2">
              {/* Wallet Balance */}
              <div className="bg-gray-800 rounded-lg p-2 border border-gray-700">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-xs">Wallet</span>
                  <button
                    onClick={() => fetchBalance(walletAddress)}
                    className="text-blue-400 hover:text-blue-300 transition-colors"
                    title="Refresh balance"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </button>
                </div>
                <p className="text-white text-sm font-bold mt-1">{balance} XLM</p>
              </div>

              {/* Deposited Balance */}
              <div className="bg-gradient-to-br from-green-900/30 to-emerald-900/30 rounded-lg p-2 border border-green-700/50">
                <div className="flex items-center justify-between">
                  <span className="text-green-400 text-xs">Contract</span>
                  <button
                    onClick={() => fetchDepositedBalance(walletAddress)}
                    className="text-green-400 hover:text-green-300 transition-colors"
                    title="Refresh deposited balance"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </button>
                </div>
                <p className="text-white text-sm font-bold mt-1">{depositedBalance} XLM</p>
              </div>
            </div>
          )}

          {/* Transaction Forms */}
          {isConnected && (
            <div className="grid grid-cols-2 gap-2">
              {/* Deposit Form */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-white flex items-center gap-1">
                  <Send className="w-3 h-3 text-red-400" />
                  Deposit
                </h3>
                <input
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-transparent text-sm"
                  disabled={loading}
                  min="0"
                  step="0.01"
                />
                <button
                  onClick={handleDeposit}
                  disabled={loading || !depositAmount}
                  className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold py-2 rounded flex items-center justify-center gap-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                >
                  <Send className="w-3 h-3" />
                  {loading ? 'Processing...' : 'Deposit'}
                </button>
              </div>

              {/* Withdraw Form */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-white flex items-center gap-1">
                  <Send className="w-3 h-3 text-green-400 rotate-180" />
                  Withdraw
                </h3>
                <input
                  type="number"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-transparent text-sm"
                  disabled={loading}
                  min="0"
                  max={depositedBalance}
                  step="0.01"
                />
                <button
                  onClick={handleWithdraw}
                  disabled={loading || !withdrawAmount || parseFloat(withdrawAmount) > parseFloat(depositedBalance)}
                  className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-semibold py-2 rounded flex items-center justify-center gap-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                >
                  <Send className="w-3 h-3 rotate-180" />
                  {loading ? 'Processing...' : 'Withdraw'}
                </button>
                <p className="text-gray-400 text-xs">
                  Avail: {depositedBalance} XLM
                </p>
              </div>
            </div>
          )}

          {/* Contract Info */}
          <div className="bg-gray-800/50 rounded-lg p-2 border border-gray-700/50 flex-shrink-0">
            <p className="text-gray-400 text-xs mb-1">Contract</p>
            <p className="text-gray-300 text-xs font-mono truncate">{CONTRACT_ADDRESS}</p>
            <a 
              href={`https://stellar.expert/explorer/testnet/contract/${CONTRACT_ADDRESS}`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-300 text-xs hover:text-blue-200 transition-colors"
            >
              View on Stellar Expert
            </a>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-800 border-t border-gray-700 p-2 text-center flex-shrink-0">
          <p className="text-gray-500 text-xs">
            Stellar Soroban • Testnet
          </p>
        </div>
      </div>
    </div>
  );
};

export default SorobanDepositApp;