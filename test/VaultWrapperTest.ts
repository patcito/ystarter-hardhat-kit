import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { assert } from "console";
import exp from "constants";
import { BigNumber } from "ethers";
import { ethers, network } from "hardhat";
import { wrap } from "module";
import {
    BaseStrategy,
    BaseStrategyInitializable,
    IERC20,
    IERC4626,
    IVault,
    SugarVault,
    VaultWrapper,
} from "typechain";
import { deployStrategy } from "./utils/deployStrategy";
import { deploySugarVault } from "./utils/deploySugarVault";
import { deployVault } from "./utils/deployVault";
import { deployVaultWrapper } from "./utils/deployVaultWrapper";
import { deployYfi, YFI } from "./utils/deployYfi";

describe("Vault Wrapper Test", function () {
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
    it("SetupVaultOk", async () => {
        expect(vault.address).to.not.undefined;
        expect(await vault.token()).to.equal(want.address);
        expect(await vault.depositLimit()).to.equal(
            ethers.constants.MaxUint256
        );
    });

    it("SetupWrappertOk", async () => {
        expect(vaultWrapper.address).to.not.undefined;
        expect(await vaultWrapper.asset()).to.equal(want.address);
    });

    it("SetupStrategyOk", async () => {
        expect(strategy.address).to.not.undefined;
        expect(await strategy.vault()).to.equal(vault.address);
        expect(
            (await vault.strategies(strategy.address)).activation.toNumber()
        ).to.greaterThan(0);
    });

    it("TestErc20Compatibility", async () => {
        const ammount = YFI(1);

        await want.connect(whale).approve(vaultWrapper.address, ammount);
        await vaultWrapper.connect(whale).deposit(ammount, whale.address);

        const shares = await vault.balanceOf(vaultWrapper.address);

        expect(await vaultWrapper.balanceOf(whale.address)).to.equal(shares);
        await vaultWrapper.connect(whale).transfer(user.address, ammount);

        expect(await want.balanceOf(vault.address)).to.equal(ammount);

        expect(await vaultWrapper.balanceOf(user.address)).to.equal(shares);
        expect(await vaultWrapper.balanceOf(whale.address)).to.equal(0);
        expect(await vaultWrapper.maxRedeem(user.address)).to.equal(shares);
        expect(await vault.balanceOf(vaultWrapper.address)).to.equal(shares);
        expect(await vaultWrapper.totalSupply()).to.equal(shares);
    });

    it("testDeposit", async () => {
        const ammount = YFI(1);
        const pricePerSharefirst = await vault.pricePerShare();
        const vaultsShares0 = await vault.balanceOf(vaultWrapper.address);

        await want.connect(whale).approve(vaultWrapper.address, ammount.mul(2));
        await vaultWrapper.connect(whale).deposit(ammount, user.address);
        const shares0 = await vaultWrapper.balanceOf(user.address);
        const pricePerShare0 = await vault.pricePerShare();
        const vaultsShares1 = await vault.balanceOf(vaultWrapper.address);
        await want.connect(whale).approve(vaultWrapper.address, ammount);
        await vaultWrapper.connect(whale).deposit(ammount, user.address);
        const shares = await vaultWrapper.balanceOf(user.address);
        const yvaultShares = await vault.balanceOf(vaultWrapper.address);
        const pricePerShare1 = await vault.pricePerShare();

        expect(await want.balanceOf(vault.address)).to.equal(ammount.mul(2));
        const vaultsShares = await vault.balanceOf(vaultWrapper.address);

        const ttswv = await vaultWrapper.totalSupply();

        expect(await vaultWrapper.maxRedeem(user.address)).to.equal(shares);
        expect(await vault.balanceOf(vaultWrapper.address)).to.not.equal(
            shares
        );
        await want.connect(whale).approve(vault.address, ammount);
        const mr0 = await vaultWrapper.maxRedeem(user.address);
        const mw0 = await vaultWrapper.maxWithdraw(user.address);
        //airdrop from whale
        await vault
            .connect(whale)
            ["deposit(uint256,address)"](ammount, vaultWrapper.address); //."deposit()"(ammount, vaultWrapper.address);
        const pricePerShare11 = await vault.pricePerShare();
        const mr = await vaultWrapper.maxRedeem(user.address);
        const mw = await vaultWrapper.maxWithdraw(user.address);

        // expect(await vaultWrapper.totalSupply()).to.not.equal(shares);
        // assertRelApproxEq(want.balanceOf(address(vault)), _amount, DELTA);
        // assertEq(vaultWrapper.balanceOf(user), _shares);
        // assertEq(vaultWrapper.maxRedeem(user), _shares);
        // assertEq(vault.balanceOf(address(vaultWrapper)), _shares);
        // assertEq(vaultWrapper.totalSupply(), _shares);
    });

    it("testWithdraw", async () => {
        const ammount = YFI(1);
        await want.connect(gov).transfer(user.address, ammount.mul(2));

        const balanceBefore = await want.balanceOf(user.address);

        await want.connect(user).approve(vaultWrapper.address, ammount);
        await vaultWrapper.connect(user).deposit(ammount, user.address);
        await want.connect(user).approve(vaultWrapper.address, ammount);
        await vaultWrapper.connect(user).deposit(ammount, user.address);

        const shares = await vault.balanceOf(vaultWrapper.address);
        const ushares = await vaultWrapper.balanceOf(user.address);

        expect(await want.balanceOf(vault.address)).to.equal(ammount.mul(2));
        //  expect((await vaultWrapper.balanceOf(user.address)).mul(2)).to.equal(
        //    shares
        //);
        /*
        expect(await vaultWrapper.maxRedeem(user.address)).to.equal(
            shares.div(2)
        );
        */
        await network.provider.send("evm_increaseTime", [180]);

        const redeemShares = await vaultWrapper.maxRedeem(user.address);
        const withdrawAssets = await vaultWrapper.maxWithdraw(user.address);

        await vaultWrapper
            .connect(user)
            .withdraw(withdrawAssets, user.address, user.address);
        /*

        expect(await want.balanceOf(user.address)).to.equal(balanceBefore);

        expect(await vaultWrapper.balanceOf(user.address)).to.equal(0);
        expect(await vaultWrapper.balanceOf(user.address)).to.equal(0);
        */
    });

    it("testStrategyOperation", async () => {
        const ammount = YFI(1);
        await want.connect(gov).transfer(user.address, ammount);

        const balanceBefore = await want.balanceOf(user.address);

        await want.connect(user).approve(vaultWrapper.address, ammount);
        await vaultWrapper.connect(user).deposit(ammount, user.address);

        const shares = await vault.balanceOf(vaultWrapper.address);

        expect(await want.balanceOf(vault.address)).to.equal(ammount);
        expect(await vaultWrapper.balanceOf(user.address)).to.equal(shares);
        expect(await vaultWrapper.maxRedeem(user.address)).to.equal(shares);

        await network.provider.send("evm_increaseTime", [180]);

        await strategy.connect(strategist).harvest();

        expect(await strategy.estimatedTotalAssets()).to.equal(ammount);

        const withdrawAmount = await vaultWrapper.maxWithdraw(user.address);
        await vaultWrapper
            .connect(user)
            .withdraw(withdrawAmount, user.address, user.address);

        expect(await want.balanceOf(user.address)).to.equal(balanceBefore);
        expect(await vaultWrapper.balanceOf(user.address)).to.equal(0);
    });

    it("testProfitableHarvest", async () => {
        const ammount = YFI(1);
        await want.connect(gov).transfer(user.address, ammount);

        // // Deposit to the vault
        await want.connect(user).approve(vaultWrapper.address, ammount);
        await vaultWrapper.connect(user).deposit(ammount, user.address);

        const shares = await vault.balanceOf(vaultWrapper.address);

        expect(await vaultWrapper.balanceOf(user.address)).to.equal(shares);
        expect(await want.balanceOf(vault.address)).to.equal(ammount);

        const beforePps = await vault.pricePerShare();
        const wrapperPps = await (
            await vaultWrapper.convertToAssets(1)
        ).mul(BigNumber.from(10).pow(await vault.decimals()));
        expect(beforePps.toString()).to.equal(wrapperPps.toString());

        await network.provider.send("evm_increaseTime", [1]);
        await network.provider.send("evm_mine", []);

        // Harvest 1: Send funds through the strategy
        await strategy.connect(strategist).harvest();
        expect(await strategy.estimatedTotalAssets()).to.equal(ammount);

        // Airdrop gains to the strategy
        await want.connect(gov).transfer(strategy.address, YFI(0.05));
        await network.provider.send("evm_increaseTime", [1]);
        await network.provider.send("evm_mine", []);

        // Harvest 2: Realize profit
        await strategy.connect(strategist).harvest();

        await network.provider.send("evm_increaseTime", [6 * 3600]);
        await network.provider.send("evm_mine", []);

        const profit = await want.balanceOf(vault.address);

        expect((await want.balanceOf(strategy.address)).add(profit).gt(ammount))
            .to.be.true;
        expect((await vault.pricePerShare()).gt(beforePps)).to.be.true;
    });
});
