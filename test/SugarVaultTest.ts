import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { assert } from "console";
import exp from "constants";
import { BigNumber } from "ethers";
import { ethers, network } from "hardhat";
import {
    BaseStrategy,
    BaseStrategyInitializable,
    IERC20,
    IERC4626,
    IVault,
    SugarVault,
    VaultWrapper,
} from "typechain";
import { relApproxyEqual } from "./utils/helper/assertApproxEq";
import { deployStrategy } from "./utils/deployStrategy";
import { deploySugarVault } from "./utils/deploySugarVault";
import { deployVault } from "./utils/deployVault";
import { deployVaultWrapper } from "./utils/deployVaultWrapper";
import { deployYfi, YFI } from "./utils/deployYfi";

describe("Sugar vault Test", function () {
    let want: IERC20;
    let vault: IVault;
    let strategy: BaseStrategyInitializable;

    let vaultWrapper: IERC4626;
    let sugarVault: SugarVault;

    let gov: SignerWithAddress;
    let user: SignerWithAddress;
    let whale: SignerWithAddress;
    let rewards: SignerWithAddress;
    let guardian: SignerWithAddress;
    let management: SignerWithAddress;
    let strategist: SignerWithAddress;
    let keeper: SignerWithAddress;

    beforeEach(async function () {
        [gov, user, whale, guardian, rewards, management, strategist, keeper] =
            await ethers.getSigners();
        want = await deployYfi();
        vault = await deployVault({
            gov,
            token: want,
            rewards,
            guardian,
            management,
        });
        strategy = await deployStrategy({ vault, keeper, strategist });
        vaultWrapper = await deployVaultWrapper(vault);
        sugarVault = await deploySugarVault(vaultWrapper);

        await vault.addStrategy(
            strategy.address,
            10000,
            BigNumber.from(0),
            ethers.constants.MaxUint256,
            BigNumber.from(1000)
        );

        //Move some YFI to the whale
        await want.connect(gov).transfer(whale.address, YFI(10));
    });

    it("SetupOk", async () => {
        expect(sugarVault.address).to.not.undefined;
        expect(await sugarVault.vault()).to.equal(vaultWrapper.address);
        expect(await sugarVault.token()).to.equal(want.address);
    });

    it("StartSharingYield", async () => {
        const ammount = YFI(10);

        await want.connect(whale).approve(sugarVault.address, ammount);
        await sugarVault
            .connect(whale)
            .startSharingYield(user.address, ammount);

        //TODO ask storming0x if its correct that the shares belonging to the wraper and not to sugar vault
        const shares = await vault.balanceOf(vaultWrapper.address);

        expect(await sugarVault.tokenBalances(whale.address)).to.equal(
            ammount.toString()
        );
        expect(await sugarVault.shareBalances(whale.address)).to.equal(
            await vaultWrapper.convertToShares(ammount)
        );

        expect(shares).to.equal(await vaultWrapper.convertToShares(ammount));
        expect(await vaultWrapper.balanceOf(sugarVault.address)).to.equal(
            await vaultWrapper.convertToShares(ammount)
        );

        expect(await want.balanceOf(whale.address)).to.equal(0);
    });

    it("StopSharingYield", async () => {
        const ammount = YFI(10);
        await want.connect(whale).approve(sugarVault.address, ammount);
        await sugarVault
            .connect(whale)
            .startSharingYield(user.address, ammount);

        await sugarVault.connect(whale).stopSharingYield();

        expect(await want.balanceOf(whale.address)).to.equal(ammount);
        expect(await sugarVault.tokenBalances(whale.address)).to.equal(0);
        expect(await sugarVault.shareBalances(whale.address)).to.equal(0);
        expect(await vaultWrapper.balanceOf(sugarVault.address)).to.equal(0);
    });

    it("ClaimYield", async () => {
        // setup
        const ammount = YFI(10);

        await want.connect(whale).approve(sugarVault.address, ammount);
        await sugarVault
            .connect(whale)
            .startSharingYield(user.address, ammount);
        const initialShares = await vault.balanceOf(vaultWrapper.address);

        // // Harvest 1: Send funds through the strategy
        await network.provider.send("evm_mine");

        await strategy.connect(strategist).harvest();

        expect(await strategy.estimatedTotalAssets()).to.equal(ammount);

        // // Airdrop gains to the strategy
        await want.connect(gov).transfer(strategy.address, YFI(5));
        await network.provider.send("evm_increaseTime", [1]);
        await network.provider.send("evm_mine", []);
        await strategy.connect(strategist).harvest();
        await network.provider.send("evm_increaseTime", [6 * 3600]);
        await network.provider.send("evm_mine", []);
        await strategy.connect(strategist).harvest();

        const claimable = await sugarVault.claimable(
            whale.address,
            user.address
        );
        const usersBalanceBefore = await want.balanceOf(user.address);

        await sugarVault.connect(user).claimYield(whale.address);
        const usersBalanceAfter = await want.balanceOf(user.address);

        await sugarVault.connect(whale).stopSharingYield();

        expect(
            relApproxyEqual(
                claimable,
                usersBalanceAfter.sub(usersBalanceBefore),
                BigNumber.from(10 ** 2)
            )
        ).to.be.true;
        expect(initialShares.gt(await sugarVault.shareBalances(whale.address)))
            .to.be.true;

        expect((await want.balanceOf(whale.address)).gte(ammount)).to.be.true;

        const whalesAssets = await vaultWrapper.convertToAssets(
            await sugarVault.shareBalances(whale.address)
        );
        expect(whalesAssets.gte(await sugarVault.tokenBalances(whale.address)))
            .to.be.true;
    });
});
