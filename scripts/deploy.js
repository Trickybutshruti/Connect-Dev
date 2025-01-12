const hre = require("hardhat");

async function main() {
  const VideoCallEscrow = await hre.ethers.getContractFactory("VideoCallEscrow");
  const videoCallEscrow = await VideoCallEscrow.deploy();

  await videoCallEscrow.deployed();

  console.log("VideoCallEscrow deployed to:", videoCallEscrow.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
