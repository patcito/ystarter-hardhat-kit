import { BigNumber } from "ethers";
import { IVault } from "typechain";

export const convertToAssets = async (shares: BigNumber, vault: IVault) => {
    const nominator = shares.mul(await vault.pricePerShare());
    const denominator = BigNumber.from(10).pow(await vault.decimals());
    return nominator.div(denominator);
};
