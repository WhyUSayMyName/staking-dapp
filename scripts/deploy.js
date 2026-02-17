const hre = require("hardhat");

async function main() {
  console.log("🚀 Deploying Staking DApp...");

  // Деплой токена
  const StakingToken = await hre.ethers.getContractFactory("StakingToken");
  const stakingToken = await StakingToken.deploy(1000000);
  await stakingToken.waitForDeployment();
  console.log("✅ StakingToken deployed to:", await stakingToken.getAddress());

  // Деплой стейкинг контракта
  const StakingContract = await hre.ethers.getContractFactory("StakingContract");
  const stakingContract = await StakingContract.deploy(
    await stakingToken.getAddress(),
    10, // reward rate
    3600 // minimum staking time (1 hour)
  );
  await stakingContract.waitForDeployment();
  console.log("✅ StakingContract deployed to:", await stakingContract.getAddress());

  console.log("\n📋 Deployment Summary:");
  console.log("Network:", hre.network.name);
  console.log("StakingToken:", await stakingToken.getAddress());
  console.log("StakingContract:", await stakingContract.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});