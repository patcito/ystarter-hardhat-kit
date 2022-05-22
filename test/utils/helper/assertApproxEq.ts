import { BigNumber } from "ethers";

export const relApproxyEqual = (
    a: BigNumber,
    b: BigNumber,
    maxPercentDelta: BigNumber
) => {
    const delta = a.gt(b) ? a.sub(b) : b.sub(a);
    const maxRelDelta = b.div(maxPercentDelta);
    return maxRelDelta.gt(delta);
};
