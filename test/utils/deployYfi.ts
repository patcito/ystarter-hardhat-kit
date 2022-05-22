import { BigNumber, BigNumberish } from "ethers";
import { ethers } from "hardhat";
import { IERC20 } from "typechain";

export const deployYfi = async () => {
    const TokenFactory = await ethers.getContractFactory("YfiToken");
    return (await TokenFactory.deploy("YFI", "YFI")) as IERC20;
};

export const YFI = (x: string | number) =>
    ethers.utils.parseUnits(x.toString(), 18);
export const printYFI = (x: BigNumberish) => ethers.utils.formatUnits(x, 18);
