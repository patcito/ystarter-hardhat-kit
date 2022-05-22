import { ethers } from "hardhat";
import { IERC4626, IVault, SugarVault, VaultWrapper } from "typechain";

export const deploySugarVault = async ({ address }: IERC4626) => {
    const SugarVaultFactory = await ethers.getContractFactory("SugarVault");
    return (await SugarVaultFactory.deploy(address)) as SugarVault;
};
