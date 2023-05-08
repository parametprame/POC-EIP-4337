import { Wallet } from "ethers";
import { ethers } from "hardhat";
import { expect } from "chai";
import {
  SimpleAccount,
  SimpleAccountFactory,
  SimpleAccountFactory__factory,
  Paymaster,
  Paymaster__factory,
  EntryPoint,
  SimpleERC721,
  SimpleERC721__factory,
} from "../typechain";
import {
  createAccountOwner,
  rethrow,
  calcGasUsage,
  deployEntryPoint,
  createAddress,
  ONE_ETH,
  createAccount,
} from "./testutils";
import { fillAndSign } from "./UserOp";
import { hexConcat, parseEther } from "ethers/lib/utils";
import { UserOperation } from "./UserOperation";
import { hexValue } from "@ethersproject/bytes";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("EntryPoint with paymaster", function () {
  let entryPoint: EntryPoint;
  let accountOwner: Wallet;
  let nft: SimpleERC721;
  const ethersSigner = ethers.provider.getSigner();
  let account: SimpleAccount;
  let factory: SimpleAccountFactory;

  function getAccountDeployer(
    entryPoint: string,
    accountOwner: string,
    _salt: number = 0
  ): string {
    return hexConcat([
      factory.address,
      hexValue(
        factory.interface.encodeFunctionData("createAccount", [
          accountOwner,
          _salt,
        ])!
      ),
    ]);
  }

  before(async function () {
    this.timeout(20000);
    // await checkForGeth();

    entryPoint = await deployEntryPoint();
    factory = await new SimpleAccountFactory__factory(ethersSigner).deploy(
      entryPoint.address
    );

    accountOwner = createAccountOwner();
    ({ proxy: account } = await createAccount(
      ethersSigner,
      await accountOwner.getAddress(),
      entryPoint.address,
      factory
    ));
  });

  describe("Paymaster : Deposit and Withdraw", () => {
    let paymaster: Paymaster;
    let ownerAddr: string;
    let pmAddr: string;
    let mcAddr: SignerWithAddress;

    before(async () => {
      paymaster = await new Paymaster__factory(ethersSigner).deploy(
        factory.address,
        entryPoint.address
      );
      pmAddr = paymaster.address;
      ownerAddr = await ethersSigner.getAddress();
      [, mcAddr] = await ethers.getSigners();
    });

    it("should deposit to entry point", async () => {
      await paymaster.connect(mcAddr).deposit({ value: parseEther("1") });

      expect(await entryPoint.balanceOf(pmAddr)).to.equal(ONE_ETH);
    });

    it("should withdraw Native Token", async () => {
      await paymaster.connect(ethersSigner).withdrawTo(mcAddr.address, ONE_ETH);
      expect(
        await entryPoint.getDepositInfo(pmAddr).then((info) => info.deposit)
      ).to.eq(0);
    });
  });

  describe("using Paymaster (paymaster pays transaction fee)", () => {
    let paymaster: Paymaster;
    let mcAddr: SignerWithAddress;
    let pmAddr: string;

    before(async () => {
      paymaster = await new Paymaster__factory(ethersSigner).deploy(
        factory.address,
        entryPoint.address
      );
      pmAddr = paymaster.address;
      nft = await new SimpleERC721__factory(ethersSigner).deploy();

      [, mcAddr] = await ethers.getSigners();
      await mcAddr.sendTransaction({
        to: entryPoint.address,
        value: parseEther("1"),
      });
    });

    describe("HandleOps", () => {
      let calldata: string;

      before(async () => {
        const mintNFT = await nft.populateTransaction
          .mintToken(account.address, 1)
          .then((tx) => tx.data!);

        calldata = await account.populateTransaction
          .execute(nft.address, 0, mintNFT)
          .then((tx) => tx.data!);

        await entryPoint
          .connect(mcAddr)
          .depositTo(pmAddr, { value: parseEther("10") });
      });

      describe("create account", () => {
        let createOp: UserOperation;
        let created = false;
        const beneficiaryAddress = createAddress();

        it("should succeed to create account", async () => {
          createOp = await fillAndSign(
            {
              initCode: getAccountDeployer(
                entryPoint.address,
                accountOwner.address,
                3
              ),
              verificationGasLimit: 2e6,
              paymasterAndData: pmAddr,
              nonce: 0,
            },
            accountOwner,
            entryPoint
          );

          const rcpt = await entryPoint
            .handleOps([createOp], beneficiaryAddress, {
              gasLimit: 1e7,
            })
            .catch(rethrow())
            .then(async (tx) => await tx!.wait());

          await calcGasUsage(rcpt, entryPoint);
          created = true;
        });

        it("should reject if account already created", async function () {
          if (!created) this.skip();
          await expect(
            entryPoint.callStatic
              .handleOps([createOp], beneficiaryAddress, {
                gasLimit: 1e7,
              })
              .catch(rethrow())
          ).to.revertedWith("sender already constructed");
        });
      });
    });
  });
});
