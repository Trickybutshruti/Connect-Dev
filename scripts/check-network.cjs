const { Web3 } = require('web3');
require('dotenv').config();

async function checkNetwork() {
    try {
        // Connect to the network
        const web3 = new Web3(process.env.VITE_RPC_URL);
        
        // Check connection
        const isConnected = await web3.eth.net.isListening();
        console.log('Connected to network:', isConnected);
        
        // Get network ID
        const networkId = await web3.eth.net.getId();
        console.log('Network ID:', networkId);
        
        // Get chain ID
        const chainId = await web3.eth.getChainId();
        console.log('Chain ID:', `0x${chainId.toString(16)}`);
        
        // Verify if it's Celo Alfajores
        const isCeloAlfajores = networkId.toString() === process.env.VITE_NETWORK_ID;
        console.log('Is Celo Alfajores:', isCeloAlfajores);
        
        // Check contract
        const code = await web3.eth.getCode(process.env.VITE_ESCROW_CONTRACT_ADDRESS);
        const hasContract = code !== '0x' && code !== '0x0';
        console.log('Contract deployed:', hasContract);
        
        console.log('\nNetwork Configuration:');
        console.log('Expected Network:', process.env.VITE_NETWORK_NAME);
        console.log('Expected Network ID:', process.env.VITE_NETWORK_ID);
        console.log('RPC URL:', process.env.VITE_RPC_URL);
        console.log('Contract Address:', process.env.VITE_ESCROW_CONTRACT_ADDRESS);
        
    } catch (error) {
        console.error('Error checking network:', error);
    }
}

checkNetwork();
