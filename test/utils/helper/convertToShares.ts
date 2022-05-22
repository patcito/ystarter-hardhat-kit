import { BigNumber } from "ethers";
import { IVault } from "typechain";

export const convertToShares = async (assets: BigNumber, vault: IVault) => {
    const nominator = assets.mul(
        BigNumber.from(10).pow(await vault.decimals())
    );
    const denominator = await vault.pricePerShare();

    return nominator.div(denominator);
};
