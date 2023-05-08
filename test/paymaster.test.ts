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
} from "../typechain";
import {
  AddressZero,
  createAccountOwner,
  fund,
  getBalance,
  rethrow,
  checkForGeth,
  calcGasUsage,
  deployEntryPoint,
  checkForBannedOps,
  createAddress,
  ONE_ETH,
  createAccount,
  getAccountAddress,
} from "./testutils";
import { fillAndSign } from "./UserOp";
import { hexConcat, parseEther } from "ethers/lib/utils";
import { UserOperation } from "./UserOperation";
import { hexValue } from "@ethersproject/bytes";

describe("EntryPoint with paymaster", function () {
  let entryPoint: EntryPoint;
  let accountOwner: Wallet;
  const ethersSigner = ethers.provider.getSigner();
  let account: SimpleAccount;
  const beneficiaryAddress = "0x".padEnd(42, "1");
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

  describe("- Paymaster", () => {
    let paymaster: Paymaster;
    const otherAddr = createAddress();
    let ownerAddr: string;
    let pmAddr: string;

    before(async () => {
      paymaster = await new Paymaster__factory(ethersSigner).deploy(
        factory.address,
        entryPoint.address
      );
      pmAddr = paymaster.address;
      ownerAddr = await ethersSigner.getAddress();
    });

    it("should have deposit to entry point", async () => {
      //   await ethers.provider.getSigner().sendTransaction({
      //     to: paymaster.address,
      //     value: parseEther("1000"),
      //   });

      await ethers.provider.getSigner().sendTransaction({
        to: entryPoint.address,
        value: parseEther("1000"),
      });

      console.log(await entryPoint.getDepositInfo(ownerAddr));
      console.log(await entryPoint.getDepositInfo(paymaster.address));

      //   expect(await entryPoint.balanceOf(ownerAddr)).to.equal(ONE_ETH);
    });
  });
});
