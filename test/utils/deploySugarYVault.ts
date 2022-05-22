import { ethers } from "hardhat";
import { IVault, SugarYvault } from "typechain";

export const deploySugarYVault = async ({ address }: IVault) => {
    const SugarVaultFactory = await ethers.getContractFactory("SugarYvault");
    return (await SugarVaultFactory.deploy(address)) as SugarYvault;
};
