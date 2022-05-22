import { ethers } from "hardhat";
import { IVault, VaultWrapper } from "typechain";

export const deployVaultWrapper = async (
    vault: IVault
): Promise<VaultWrapper> => {
    const VaultWrapperFactory = await ethers.getContractFactory("VaultWrapper");
    return (await VaultWrapperFactory.deploy(vault.address)) as VaultWrapper;
};
