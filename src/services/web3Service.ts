import Web3 from 'web3';
import { Contract } from 'web3-eth-contract';
import { VIDEO_CALL_ESCROW_ABI } from '../contracts/VideoCallEscrow';

declare global {
    interface Window {
        ethereum: any;
    }
}

class Web3Service {
    private web3: Web3;
    private contract: Contract;
    private contractAddress: string;

    constructor() {
        if (typeof window !== 'undefined' && typeof window.ethereum !== 'undefined') {
            this.web3 = new Web3(window.ethereum);
        } else {
            throw new Error('Please install MetaMask to use this application');
        }
    }

    private getEnvVar(name: string): string {
        // Try VITE_ prefix first, then REACT_APP_
        const value = import.meta.env[`VITE_${name}`] || import.meta.env[`REACT_APP_${name}`];
        if (!value) {
            throw new Error(`Environment variable ${name} not found with either VITE_ or REACT_APP_ prefix`);
        }
        return value;
    }

    private async initializeContract() {
        if (!this.contract) {
            try {
                const contractAddress = this.getEnvVar('ESCROW_CONTRACT_ADDRESS');
                console.log('Initializing contract with address:', contractAddress);

                // Check if the address is valid
                if (!this.web3.utils.isAddress(contractAddress)) {
                    throw new Error('Invalid contract address format');
                }

                // Check if there's code at the address
                const code = await this.web3.eth.getCode(contractAddress);
                if (code === '0x' || code === '0x0') {
                    throw new Error('No contract found at the specified address');
                }

                // Initialize contract with ABI
                this.contract = new this.web3.eth.Contract(
                    VIDEO_CALL_ESCROW_ABI,
                    contractAddress
                );

                // Verify contract by calling a view function
                try {
                    await this.contract.methods.owner().call();
                } catch (error) {
                    console.error('Error calling contract view function:', error);
                    throw new Error('Contract verification failed. The ABI might not match the deployed contract.');
                }

                console.log('Contract initialized successfully:', {
                    address: contractAddress,
                    methods: Object.keys(this.contract.methods)
                });
            } catch (error: any) {
                console.error('Contract initialization error:', error);
                throw new Error(`Failed to initialize contract: ${error.message}`);
            }
        }
        return this.contract;
    }

    private async validateNetwork(): Promise<void> {
        try {
            const networkId = await this.web3.eth.net.getId();
            const expectedNetworkIdStr = this.getEnvVar('NETWORK_ID');
            const networkName = this.getEnvVar('NETWORK_NAME');
            
            // Convert both to strings for comparison to avoid type mismatches
            const currentNetworkStr = networkId.toString();
            
            console.log('Network validation:', {
                current: networkId,
                currentStr: currentNetworkStr,
                expected: expectedNetworkIdStr,
                networkName: networkName,
                isEqual: currentNetworkStr === expectedNetworkIdStr
            });

            if (currentNetworkStr !== expectedNetworkIdStr) {
                await this.switchToCeloNetwork();
            }

            // Check if we can connect to the network
            await this.web3.eth.net.isListening();
        } catch (error: any) {
            console.error('Network validation error:', error);
            throw new Error('Failed to validate network. Please ensure you are connected to Celo Alfajores network.');
        }
    }

    private async switchToCeloNetwork() {
        try {
            const networkId = this.getEnvVar('NETWORK_ID');
            const networkName = this.getEnvVar('NETWORK_NAME');
            const rpcUrl = this.getEnvVar('RPC_URL');
            const chainId = `0x${parseInt(networkId).toString(16)}`;

            await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{
                    chainId: chainId,
                    chainName: networkName,
                    nativeCurrency: {
                        name: 'Celo',
                        symbol: 'CELO',
                        decimals: 18
                    },
                    rpcUrls: [rpcUrl],
                    blockExplorerUrls: ['https://alfajores.celoscan.io/']
                }]
            });

            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: chainId }]
            });

            console.log('Successfully switched to Celo network');
        } catch (error: any) {
            console.error('Error switching network:', error);
            throw new Error('Failed to switch to Celo network. Please switch manually in your wallet.');
        }
    }

    async connectWallet(): Promise<string[]> {
        try {
            // First ensure we're on Celo network
            await this.switchToCeloNetwork();
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            return accounts;
        } catch (error) {
            throw new Error('Failed to connect wallet');
        }
    }

    private convertToBytes32(str: string): string {
        // Add a check for empty or null string
        if (!str) {
            throw new Error('Cannot convert empty string to bytes32');
        }

        // Hash the string first to ensure fixed length
        const hash = this.web3.utils.keccak256(str);
        
        console.log('Converting to bytes32:', {
            input: str,
            hash: hash,
            length: hash.length
        });
        
        return hash;
    }

    
    async createCall(callId: string, developerAddress: string, duration: number, amount: string): Promise<string> {
        try {
            await this.initializeContract();
            
            // Ensure we're on the correct network
            await this.validateNetwork();
            
            const accounts = await this.connectWallet();
            const account = accounts[0];

            // Input validation
            if (!this.web3.utils.isAddress(developerAddress)) {
                throw new Error('Invalid developer address');
            }
            if (!duration || duration <= 0) {
                throw new Error('Duration must be greater than 0');
            }
            if (parseFloat(amount) <= 0) {
                throw new Error('Amount must be greater than 0');
            }
            if (!callId) {
                throw new Error('CallId is required');
            }

            // Convert callId to bytes32
            const callIdBytes32 = this.convertToBytes32(callId);

            // Convert amount to Wei
            const amountInWei = this.web3.utils.toWei(amount, 'ether');

            // Convert duration to seconds and ensure it's a valid number
            const durationInSeconds = Math.max(1, Math.floor(duration * 60));
            
            // Check if call exists
            try {
                await this.contract.methods.doesCallExist(callIdBytes32).call();
            } catch (error) {
                console.log('Call does not exist, proceeding with creation');
            }
            
            // Log transaction parameters
            console.log('Creating call with parameters:', {
                callId: callId,
                callIdBytes32: callIdBytes32,
                developer: developerAddress,
                duration: duration,
                durationInSeconds: durationInSeconds,
                amount: amount,
                amountInWei: amountInWei,
                from: account,
                contract: this.contract.options.address
            });

            // Check contract deployment
            const code = await this.web3.eth.getCode(this.contract.options.address);
            if (code === '0x' || code === '0x0') {
                throw new Error('Contract not found at the specified address. Please check your configuration.');
            }

            // Create contract method call
            const method = this.contract.methods.createCall(
                callIdBytes32,
                developerAddress,
                durationInSeconds
            );

            // Prepare transaction object
            const txObject = {
                from: account,
                to: this.contract.options.address,
                data: method.encodeABI(),
                value: amountInWei
            };

            // Try to get revert reason before sending transaction
            try {
                await this.web3.eth.call(txObject);
            } catch (error: any) {
                console.error('Transaction would fail:', error);
                const revertReason = await this.getRevertReason(txObject);
                throw new Error(`Transaction would fail: ${revertReason}`);
            }

            // Get gas estimate
            const gasEstimate = await this.web3.eth.estimateGas(txObject);

            // Add 20% buffer to gas estimate
            const gasLimit = Math.floor(Number(gasEstimate) * 1.2).toString();

            // Get current gas price
            const gasPrice = await this.web3.eth.getGasPrice();

            // Add gas parameters to transaction object
            const finalTxObject = {
                ...txObject,
                gas: gasLimit,
                gasPrice: gasPrice.toString()
            };

            // Log final transaction object
            console.log('Final transaction object:', finalTxObject);

            // Send transaction
            const receipt = await this.web3.eth.sendTransaction(finalTxObject);

            console.log('Call created successfully:', receipt);
            return receipt.transactionHash;

        } catch (error: any) {
            console.error('Error creating call:', error);

            // Handle specific errors
            if (error.message.includes('insufficient funds')) {
                const balance = await this.web3.eth.getBalance(account);
                const balanceInEther = this.web3.utils.fromWei(balance, 'ether');
                throw new Error(`Insufficient funds. Your balance: ${balanceInEther} CELO`);
            }

            if (error.message.includes('User denied')) {
                throw new Error('Transaction was rejected. Please try again and approve the transaction in your wallet.');
            }

            // Check if it's a network error
            if (error.message.includes('Internal JSON-RPC error')) {
                throw new Error(
                    'Network error. Please check:\n' +
                    '1. You are connected to the Celo Alfajores network\n' +
                    '2. You have enough CELO for gas fees\n' +
                    '3. The transaction parameters are correct\n' +
                    '4. Try refreshing the page and trying again'
                );
            }

            // Generic error
            throw error;
        }
    }

    async startCall(callId: string): Promise<string> {
        try {
            await this.initializeContract();
            const accounts = await this.connectWallet();
            const account = accounts[0];

            // Convert callId to bytes32
            const callIdBytes32 = this.convertToBytes32(callId);
            console.log('Call ID converted to bytes32:', callIdBytes32);

            console.log('Starting call:', {
                callId: callIdBytes32,
                account: account.toLowerCase(),
                networkId: await this.web3.eth.net.getId()
            });

            // Prepare transaction
            const tx = this.contract.methods.startCall(callIdBytes32);
            
            // Get gas estimate
            const gasEstimate = await tx.estimateGas({ from: account });

            // Add 20% buffer to gas estimate
            const gasLimit = Math.floor(Number(gasEstimate) * 1.2).toString();

            // Get current gas price
            const gasPrice = await this.web3.eth.getGasPrice();

            // Send transaction with higher gas and timeout
            const receipt = await tx.send({
                from: account,
                gas: gasLimit,
                gasPrice: gasPrice.toString(),
                maxPriorityFeePerGas: null,
                maxFeePerGas: null
            })
            .on('transactionHash', (hash: string) => {
                console.log('Transaction hash:', hash);
            })
            .on('error', (error: any) => {
                console.error('Transaction error:', error);
                throw error;
            });

            console.log('Call started successfully:', receipt);
            return receipt.transactionHash;

        } catch (error: any) {
            console.error('Error starting call:', error);
            throw error;
        }
    }

  

    private async validateDuration(duration: number): Promise<string> {
        // Ensure duration is a positive number
        if (!duration || duration <= 0) {
            throw new Error('Duration must be greater than 0');
        }

        // Convert duration to seconds
        const durationInSeconds = Math.max(1, Math.floor(duration * 60));
        
        // Convert to string to avoid BigNumber issues
        return durationInSeconds.toString();
    }

    private getCustomErrorName(errorData: string): string {
        // Custom error signatures
        const errorSignatures: { [key: string]: string } = {
            '17c69794': 'CallNotFound',
            '7939f424': 'InvalidAmount',
            'c2d5b4b5': 'InvalidDuration',
            'd1ab6ccd': 'InvalidDeveloper',
            'f47d84c4': 'CallAlreadyExists',
            '3bcc8979': 'CallAlreadyStarted',
            '0de69ddb': 'CallAlreadyCompleted',
            'b5babb70': 'Unauthorized',
            '0c4e4138': 'SelfBookingNotAllowed',
            'f7c3d683': 'DurationNotMet',
            '8a0d5d23': 'PaymentFailed'
        };

        // Extract the first 8 characters after '0x'
        const errorSignature = errorData.slice(2, 10);
        return errorSignatures[errorSignature] || 'Unknown error';
    }

    private async getRevertReason(txData: any): Promise<string> {
        try {
            await this.web3.eth.call(txData);
            return 'No revert reason found';
        } catch (error: any) {
            console.log('Full error object:', error);
            
            // Try to extract custom error data
            if (error.data?.data) {
                const errorData = error.data.data;
                console.log('Error data:', errorData);
                
                // Get custom error name
                const errorName = this.getCustomErrorName(errorData);
                console.log('Custom error name:', errorName);

                // Provide user-friendly error message
                switch (errorName) {
                    case 'CallNotFound':
                        return 'Call not found with the given ID';
                    case 'InvalidAmount':
                        return 'Invalid payment amount';
                    case 'InvalidDuration':
                        return 'Invalid call duration';
                    case 'InvalidDeveloper':
                        return 'Invalid developer address';
                    case 'CallAlreadyExists':
                        return 'A call with this ID already exists';
                    case 'CallAlreadyStarted':
                        return 'Call has already started';
                    case 'CallAlreadyCompleted':
                        return 'Call has already been completed';
                    case 'Unauthorized':
                        return 'Unauthorized: you are not the client for this call';
                    case 'SelfBookingNotAllowed':
                        return 'You cannot book a call with yourself';
                    case 'DurationNotMet':
                        return 'Call duration requirement not met';
                    case 'PaymentFailed':
                        return 'Payment transfer failed';
                    default:
                        return `Contract error: ${errorName}`;
                }
            }

            // Try to extract the revert reason from message
            const revertReasonMatch = error.message.match(/execution reverted: (.*?)(?:\n|$)/);
            if (revertReasonMatch) return revertReasonMatch[1];

            return error.message;
        }
    }

    // Convert Wei to CELO with proper decimal handling
    private weiToCelo(wei: string): number {
        return Number(this.web3.utils.fromWei(wei, 'ether'));
    }

    // Convert CELO to Wei
    private celoToWei(celo: number): string {
        return this.web3.utils.toWei(celo.toString(), 'ether');
    }

    // Calculate reasonable gas price
    private async getReasonableGasPrice(): Promise<string> {
        try {
            // Get current network gas price
            const networkGasPrice = await this.web3.eth.getGasPrice();
            console.log('Network gas price (wei):', networkGasPrice);
            
            // Convert to gwei for easier calculation
            const networkPriceGwei = Number(this.web3.utils.fromWei(networkGasPrice, 'gwei'));
            
            // For testnet, cap at 1 gwei to prevent excessive fees
            const maxGasPriceGwei = 1;
            const finalGasPriceGwei = Math.min(networkPriceGwei, maxGasPriceGwei);
            
            // Convert back to wei
            const finalGasPrice = this.web3.utils.toWei(finalGasPriceGwei.toString(), 'gwei');
            
            console.log('Gas price calculation:', {
                networkPrice: networkPriceGwei + ' gwei',
                maxPrice: maxGasPriceGwei + ' gwei',
                finalPrice: finalGasPriceGwei + ' gwei',
                inWei: finalGasPrice
            });

            return finalGasPrice;
        } catch (error) {
            console.error('Error getting network gas price:', error);
            // Fallback to 0.1 gwei if network price fetch fails
            return this.web3.utils.toWei('0.1', 'gwei');
        }
    }

    async completeCall(callId: string): Promise<string> {
        try {
            console.log('Starting completeCall for:', { callId });

            await this.initializeContract();
            await this.validateNetwork();
            
            const accounts = await this.connectWallet();
            const account = accounts[0].toLowerCase();

            const callIdBytes32 = this.convertToBytes32(callId);

            // Get call details and validate state
            let callDetails;
            try {
                callDetails = await this.contract.methods.getCallDetails(callIdBytes32).call();
                
                if (callDetails.isCompleted) {
                    throw new Error('Call has already been completed');
                }

                if (callDetails.isPaid) {
                    throw new Error('Payment has already been released');
                }

                if (!callDetails.amount || callDetails.amount === '0') {
                    throw new Error('No payment amount available');
                }

                if (callDetails.developer.toLowerCase() !== account) {
                    throw new Error('Only the developer can complete the call');
                }

                // Verify contract balance
                const contractBalance = await this.web3.eth.getBalance(this.contract.options.address);
                const balanceCelo = this.weiToCelo(contractBalance);
                const amountCelo = this.weiToCelo(callDetails.amount);
                
                if (balanceCelo < amountCelo) {
                    throw new Error(`Insufficient contract balance. Has: ${balanceCelo} CELO, Needs: ${amountCelo} CELO`);
                }
            } catch (error: any) {
                console.error('Error checking call details:', error);
                throw error;
            }

            // Get current nonce
            const nonce = await this.web3.eth.getTransactionCount(account, 'latest');

            // Get network gas price
            const gasPrice = await this.getReasonableGasPrice();

            // Prepare transaction data
            const data = this.contract.methods.completeCall(callIdBytes32).encodeABI();

            // Estimate gas with safety margin
            let gasLimit;
            try {
                const estimate = await this.web3.eth.estimateGas({
                    from: account,
                    to: this.contract.options.address,
                    data: data,
                    value: '0'
                });
                // Add 20% buffer to estimated gas
                gasLimit = Math.floor(estimate * 1.2);
                console.log('Gas estimate:', {
                    initial: estimate,
                    withBuffer: gasLimit
                });
            } catch (error) {
                console.warn('Error estimating gas, using fallback:', error);
                gasLimit = 80000; // Conservative fallback
            }

            // Calculate estimated transaction cost
            const estimatedCost = this.weiToCelo(
                (BigInt(gasLimit) * BigInt(gasPrice)).toString()
            );

            console.log('Transaction setup:', {
                gasPrice: this.web3.utils.fromWei(gasPrice, 'gwei') + ' gwei',
                gasLimit: gasLimit,
                estimatedCost: estimatedCost + ' CELO'
            });

            // Prepare transaction with network values
            const txParams = {
                from: account,
                to: this.contract.options.address,
                gas: this.web3.utils.toHex(gasLimit),
                gasPrice: this.web3.utils.toHex(gasPrice),
                data: data,
                nonce: this.web3.utils.toHex(nonce),
                value: '0x0'
            };

            // Send transaction
            const txHash = await window.ethereum.request({
                method: 'eth_sendTransaction',
                params: [txParams]
            });

            console.log('Transaction sent:', txHash);

            // Wait for confirmation
            let receipt = null;
            let attempts = 0;
            const maxAttempts = 30;

            while (!receipt && attempts < maxAttempts) {
                try {
                    receipt = await this.web3.eth.getTransactionReceipt(txHash);
                    if (receipt) {
                        if (!receipt.status) {
                            throw new Error('Transaction failed');
                        }

                        // Verify payment was completed
                        const updatedCall = await this.contract.methods.getCallDetails(callIdBytes32).call();
                        if (!updatedCall.isPaid) {
                            throw new Error('Payment not confirmed after transaction');
                        }

                        const actualCost = this.weiToCelo(
                            (BigInt(receipt.gasUsed) * BigInt(gasPrice)).toString()
                        );

                        console.log('Payment confirmed:', {
                            txHash,
                            blockNumber: receipt.blockNumber,
                            gasUsed: receipt.gasUsed,
                            actualCost: actualCost + ' CELO'
                        });
                        break;
                    }
                } catch (error) {
                    console.error('Error checking receipt:', error);
                }
                await new Promise(resolve => setTimeout(resolve, 1000));
                attempts++;
            }

            if (!receipt) {
                throw new Error('Transaction not confirmed after 30 seconds');
            }

            return txHash;
        } catch (error: any) {
            console.error('Error completing call:', error);
            throw new Error(`Failed to complete call: ${error.message}`);
        }
    }

    async getCallDetails(callId: string) {
        try {
            await this.initializeContract();
            const callIdString = callId.toString();
            const callIdBytes32 = this.convertToBytes32(callIdString);
            const result = await this.contract.methods.getCallDetails(
                callIdBytes32
            ).call();

            return {
                client: result.client,
                developer: result.developer,
                amount: this.weiToCelo(result.amount),
                duration: result.duration,
                startTime: result.startTime,
                isActive: result.isActive,
                isCompleted: result.isCompleted,
                isPaid: result.isPaid
            };
        } catch (error) {
            throw new Error('Failed to get call details');
        }
    }

    async checkNetworkStatus(): Promise<{
        isConnected: boolean;
        networkId: number;
        networkName: string;
        chainId: string;
        account: string | null;
        balance: string;
    }> {
        try {
            // Check if connected to network
            const isConnected = await this.web3.eth.net.isListening();
            
            // Get network ID
            const networkId = await this.web3.eth.net.getId();
            
            // Get chain ID
            const chainId = await this.web3.eth.getChainId();
            
            // Get connected account
            const accounts = await this.web3.eth.getAccounts();
            const account = accounts[0] || null;
            
            // Get account balance if available
            let balance = '0';
            if (account) {
                const balanceWei = await this.web3.eth.getBalance(account);
                balance = this.web3.utils.fromWei(balanceWei, 'ether');
            }

            // Get expected network details
            const expectedNetworkId = this.getEnvVar('NETWORK_ID');
            const expectedNetworkName = this.getEnvVar('NETWORK_NAME');

            // Check if we're on the correct network
            const isCorrectNetwork = networkId.toString() === expectedNetworkId;

            console.log('Network Status:', {
                isConnected,
                networkId,
                chainId: `0x${chainId.toString(16)}`,
                expectedNetworkId,
                expectedNetworkName,
                isCorrectNetwork,
                account,
                balanceCELO: balance
            });

            return {
                isConnected,
                networkId,
                networkName: isCorrectNetwork ? expectedNetworkName : 'Unknown Network',
                chainId: `0x${chainId.toString(16)}`,
                account,
                balance
            };
        } catch (error) {
            console.error('Error checking network status:', error);
            throw new Error('Failed to check network status');
        }
    }
}

export const web3Service = new Web3Service();
export default web3Service;
