import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Sign } from "crypto";
import { ethers } from "hardhat";
import { IERC20, IVault } from "typechain";
import { abi, bytecode } from "./../../abi/Vault.json";

interface DeployVaultArgs {
    gov: SignerWithAddress;
    token: IERC20;
    rewards: SignerWithAddress;
    guardian: SignerWithAddress;
    management: SignerWithAddress;
}

export const deployVault = async ({
    gov,
    token,
    rewards,
    guardian,
    management,
}: DeployVaultArgs): Promise<IVault> => {
    const VaultAPIFactory = await ethers.getContractFactory(abi, bytecode, gov);
    const vault = (await VaultAPIFactory.deploy()) as IVault;

    /**
     * When the contstuctor is overloaded like in Vault.vy you need to pass the raw function selector to access the wanted function
     * @link{https://github.com/ethers-io/ethers.js/issues/407}
     *  */

    //@ts-ignore
    await vault[
        "initialize(address,address,address,string,string,address,address)"
    ](
        token.address,
        gov.address,
        rewards.address,
        "",
        "",
        guardian.address,
        management.address
    );

    await vault.setDepositLimit(ethers.constants.MaxUint256);

    return vault as IVault;
};
