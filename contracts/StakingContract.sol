// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title StakingContract
 * @dev Простой контракт для стейкинга токенов с наградами
 */
contract StakingContract is ReentrancyGuard, Ownable {
    IERC20 public immutable stakingToken;
    
    uint256 public rewardRate;
    uint256 public minimumStakingTime;
    
    struct StakeInfo {
        uint256 amount;
        uint256 startTime;
        uint256 lastClaimTime;
    }
    
    mapping(address => StakeInfo) public stakes;
    uint256 public totalStaked;
    
    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardClaimed(address indexed user, uint256 reward);
    event RewardRateUpdated(uint256 newRate);
    
    constructor(
        address _stakingToken,
        uint256 _rewardRate,
        uint256 _minimumStakingTime
    ) Ownable(msg.sender) {
        require(_stakingToken != address(0), "Invalid token address");
        stakingToken = IERC20(_stakingToken);
        rewardRate = _rewardRate;
        minimumStakingTime = _minimumStakingTime;
    }
    
    function stake(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        
        StakeInfo storage userStake = stakes[msg.sender];
        
        if (userStake.amount > 0) {
            _claimReward(msg.sender, userStake);
        }
        
        require(
            stakingToken.transferFrom(msg.sender, address(this), amount),
            "Transfer failed"
        );
        
        if (userStake.amount == 0) {
            userStake.startTime = block.timestamp;
            userStake.lastClaimTime = block.timestamp;
        }
        
        userStake.amount += amount;
        totalStaked += amount;
        
        emit Staked(msg.sender, amount);
    }
    
    function withdraw(uint256 amount) external nonReentrant {
        StakeInfo storage userStake = stakes[msg.sender];
        
        require(userStake.amount >= amount, "Insufficient staked amount");
        require(
            block.timestamp >= userStake.startTime + minimumStakingTime,
            "Minimum staking time not reached"
        );
        
        _claimReward(msg.sender, userStake);
        
        userStake.amount -= amount;
        totalStaked -= amount;
        
        if (userStake.amount == 0) {
            userStake.startTime = 0;
            userStake.lastClaimTime = 0;
        }
        
        require(
            stakingToken.transfer(msg.sender, amount),
            "Transfer failed"
        );
        
        emit Withdrawn(msg.sender, amount);
    }
    
    function claimReward() external nonReentrant {
        StakeInfo storage userStake = stakes[msg.sender];
        require(userStake.amount > 0, "No staked tokens");
        
        _claimReward(msg.sender, userStake);
    }
    
    function _claimReward(address user, StakeInfo storage userStake) internal {
        uint256 reward = calculateReward(user);
        
        if (reward > 0) {
            userStake.lastClaimTime = block.timestamp;
            
            require(
                stakingToken.transfer(user, reward),
                "Reward transfer failed"
            );
            
            emit RewardClaimed(user, reward);
        }
    }
    
    function calculateReward(address user) public view returns (uint256) {
        StakeInfo memory userStake = stakes[user];
        
        if (userStake.amount == 0) {
            return 0;
        }
        
        uint256 stakingDuration = block.timestamp - userStake.lastClaimTime;
        return (userStake.amount * rewardRate * stakingDuration) / 1e18;
    }
    
    function getStakeInfo(address user) external view returns (
        uint256 amount,
        uint256 startTime,
        uint256 lastClaimTime,
        uint256 pendingReward
    ) {
        StakeInfo memory userStake = stakes[user];
        return (
            userStake.amount,
            userStake.startTime,
            userStake.lastClaimTime,
            calculateReward(user)
        );
    }
    
    function setRewardRate(uint256 _rewardRate) external onlyOwner {
        rewardRate = _rewardRate;
        emit RewardRateUpdated(_rewardRate);
    }
    
    function recoverTokens(uint256 amount) external onlyOwner {
        require(
            amount <= stakingToken.balanceOf(address(this)) - totalStaked,
            "Cannot withdraw staked tokens"
        );
        require(
            stakingToken.transfer(owner(), amount),
            "Transfer failed"
        );
    }
}