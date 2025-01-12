require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.26",
  paths: {
    artifacts: './src/artifacts',
    sources: './src/contracts'
  },
  networks: {
    hardhat: {
      chainId: 1337
    },
    alfajores: {
      url: "https://alfajores-forno.celo-testnet.org",
      accounts: [process.env.PRIVATE_KEY || ""],
      chainId: 44787
    }
  }
};
