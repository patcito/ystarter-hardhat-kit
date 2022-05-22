import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers } from "hardhat";
import {
    BaseStrategy,
    BaseStrategyInitializable,
    IVault,
    MockStrategy,
} from "typechain";

interface DeployStrategyArgs {
    vault: IVault;
    keeper: SignerWithAddress;
    strategist: SignerWithAddress;
}

export const deployStrategy = async ({
    keeper,
    vault,
    strategist,
}: DeployStrategyArgs): Promise<BaseStrategyInitializable> => {
    const MockStrategyFactory = await ethers.getContractFactory("MockStrategy");
    const strategy = (await MockStrategyFactory.connect(strategist).deploy(
        vault.address
    )) as MockStrategy;
    await strategy.connect(strategist).setKeeper(keeper.address);

    return strategy;
};
