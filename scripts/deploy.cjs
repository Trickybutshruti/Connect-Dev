const hre = require("hardhat");

async function main() {
  const VideoCallEscrow = await hre.ethers.getContractFactory("VideoCallEscrow");
  console.log("Deploying VideoCallEscrow...");
  
  const videoCallEscrow = await VideoCallEscrow.deploy();
  console.log("Waiting for deployment...");
  await videoCallEscrow.waitForDeployment();

  const address = await videoCallEscrow.getAddress();
  console.log("VideoCallEscrow deployed to:", address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
