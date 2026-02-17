const { expect } = require("chai");
const { time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("StakingContract", function () {
  let stakingToken, stakingContract, owner, user1, user2;
  const INITIAL_SUPPLY = 1000000;
  const REWARD_RATE = 10; // 10 токенов за секунду на 1 застейканный
  const MIN_STAKING_TIME = 3600; // 1 час

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    // Деплой токена
    const StakingToken = await ethers.getContractFactory("StakingToken");
    stakingToken = await StakingToken.deploy(INITIAL_SUPPLY);

    // Деплой стейкинг контракта
    const StakingContract = await ethers.getContractFactory("StakingContract");
    stakingContract = await StakingContract.deploy(
      await stakingToken.getAddress(),
      REWARD_RATE,
      MIN_STAKING_TIME
    );

    // Переводим токены пользователям для тестов
    await stakingToken.transfer(user1.address, 10000);
    await stakingToken.transfer(user2.address, 10000);

    // Аппрувим стейкинг контракт
    await stakingToken.connect(user1).approve(await stakingContract.getAddress(), 10000);
    await stakingToken.connect(user2).approve(await stakingContract.getAddress(), 10000);
  });

  describe("Staking", function () {
    it("Should allow users to stake tokens", async function () {
      const stakeAmount = 1000;
      
      await stakingContract.connect(user1).stake(stakeAmount);
      
      const stakeInfo = await stakingContract.getStakeInfo(user1.address);
      expect(stakeInfo.amount).to.equal(stakeAmount);
      expect(await stakingContract.totalStaked()).to.equal(stakeAmount);
    });

    it("Should emit Staked event", async function () {
      const stakeAmount = 1000;
      
      await expect(stakingContract.connect(user1).stake(stakeAmount))
        .to.emit(stakingContract, "Staked")
        .withArgs(user1.address, stakeAmount);
    });

    it("Should not allow staking 0 tokens", async function () {
      await expect(stakingContract.connect(user1).stake(0))
        .to.be.revertedWith("Amount must be greater than 0");
    });
  });

  describe("Withdrawal", function () {
    it("Should not allow withdrawal before minimum staking time", async function () {
      await stakingContract.connect(user1).stake(1000);
      
      await expect(stakingContract.connect(user1).withdraw(500))
        .to.be.revertedWith("Minimum staking time not reached");
    });

    it("Should allow withdrawal after minimum staking time", async function () {
      await stakingContract.connect(user1).stake(1000);
      
      // Мотаем время вперёд
      await time.increase(MIN_STAKING_TIME + 1);
      
      await stakingContract.connect(user1).withdraw(500);
      
      const stakeInfo = await stakingContract.getStakeInfo(user1.address);
      expect(stakeInfo.amount).to.equal(500);
    });
  });

  describe("Rewards", function () {
    it("Should calculate rewards correctly", async function () {
      await stakingContract.connect(user1).stake(1000);
      
      // Ждём 100 секунд
      await time.increase(100);
      
      const reward = await stakingContract.calculateReward(user1.address);
      expect(reward).to.be.greaterThan(0);
    });

    it("Should allow claiming rewards", async function () {
      await stakingContract.connect(user1).stake(1000);
      
      await time.increase(100);
      
      const rewardBefore = await stakingToken.balanceOf(user1.address);
      await stakingContract.connect(user1).claimReward();
      const rewardAfter = await stakingToken.balanceOf(user1.address);
      
      expect(rewardAfter).to.be.greaterThan(rewardBefore);
    });
  });
});