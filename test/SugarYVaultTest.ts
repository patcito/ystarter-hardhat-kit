import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers, network } from "hardhat";
import {
    BaseStrategyInitializable,
    IERC20,
    IVault,
    SugarYvault,
} from "typechain";
import { deployStrategy } from "./utils/deployStrategy";
import { deploySugarYVault } from "./utils/deploySugarYVault";
import { deployVault } from "./utils/deployVault";
import { deployYfi, YFI } from "./utils/deployYfi";
import { relApproxyEqual } from "./utils/helper/assertApproxEq";
import { convertToAssets } from "./utils/helper/convertToAssets";
import { convertToShares } from "./utils/helper/convertToShares";

describe("SugarYVaultTest ", function () {
    let want: IERC20;
    let vault: IVault;
    let strategy: BaseStrategyInitializable;

    let sugarYVault: SugarYvault;

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
        sugarYVault = await deploySugarYVault(vault);

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
        expect(sugarYVault.address).to.not.undefined;
        expect(await sugarYVault.vault()).to.equal(vault.address);
        expect(await sugarYVault.token()).to.equal(want.address);
    });

    it("StartSharingYield", async () => {
        const ammount = YFI(10);

        await want.connect(whale).approve(sugarYVault.address, ammount);
        await sugarYVault
            .connect(whale)
            .startSharingYield(user.address, ammount);

        //TODO ask storming0x if its correct that the shares belonging to the wraper and not to sugar vault
        const shares = await vault.balanceOf(sugarYVault.address);

        expect(await sugarYVault.tokenBalances(whale.address)).to.equal(
            ammount.toString()
        );
        expect(await sugarYVault.shareBalances(whale.address)).to.equal(
            await convertToShares(ammount, vault)
        );

        expect(shares.eq(await convertToShares(ammount, vault))).to.be.true;
        expect(await vault.balanceOf(sugarYVault.address)).to.equal(
            await convertToShares(ammount, vault)
        );

        expect(await want.balanceOf(whale.address)).to.equal(0);
    });
    it("StopSharingYield", async () => {
        const ammount = YFI(10);
        await want.connect(whale).approve(sugarYVault.address, ammount);
        await sugarYVault
            .connect(whale)
            .startSharingYield(user.address, ammount);

        await sugarYVault.connect(whale).stopSharingYield();

        expect(await want.balanceOf(whale.address)).to.equal(ammount);
        expect(await sugarYVault.tokenBalances(whale.address)).to.equal(0);
        expect(await sugarYVault.shareBalances(whale.address)).to.equal(0);
        expect(await vault.balanceOf(sugarYVault.address)).to.equal(0);
    });
    it("ClaimYield", async () => {
        // setup
        const ammount = YFI(10);

        await want.connect(whale).approve(sugarYVault.address, ammount);
        await sugarYVault
            .connect(whale)
            .startSharingYield(user.address, ammount);
        const initialShares = await vault.balanceOf(sugarYVault.address);

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

        const claimable = await sugarYVault.claimable(
            whale.address,
            user.address
        );
        const usersBalanceBefore = await want.balanceOf(user.address);

        await sugarYVault.connect(user).claimYield(whale.address);
        const usersBalanceAfter = await want.balanceOf(user.address);

        await sugarYVault.connect(whale).stopSharingYield();

        expect(
            relApproxyEqual(
                claimable,
                usersBalanceAfter.sub(usersBalanceBefore),
                BigNumber.from(10 ** 2)
            )
        ).to.be.true;

        expect(initialShares.gt(await sugarYVault.shareBalances(whale.address)))
            .to.be.true;

        expect((await want.balanceOf(whale.address)).gte(ammount)).to.be.true;

        const whalesAssets = await convertToAssets(
            await sugarYVault.shareBalances(whale.address),
            vault
        );
        expect(whalesAssets.gte(await sugarYVault.tokenBalances(whale.address)))
            .to.be.true;
    });
});
