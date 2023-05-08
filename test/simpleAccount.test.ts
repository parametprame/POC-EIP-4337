import { Wallet } from "ethers";
import { ethers } from "hardhat";
import { expect } from "chai";
import {
  ERC1967Proxy__factory,
  SimpleAccount,
  SimpleAccountFactory__factory,
  SimpleAccount__factory,
  TestUtil,
  TestUtil__factory,
} from "../typechain";
import {
  createAccount,
  createAddress,
  createAccountOwner,
  deployEntryPoint,
  getBalance,
  isDeployed,
  ONE_ETH,
  HashZero,
} from "./testutils";
import {
  fillUserOpDefaults,
  getUserOpHash,
  packUserOp,
  signUserOp,
} from "./UserOp";
import { parseEther } from "ethers/lib/utils";
import { UserOperation } from "./UserOperation";

describe("SimpleAccount", function () {
  let entryPoint: string;
  let accounts: string[];
  let testUtil: TestUtil;
  let accountOwner: Wallet;
  const ethersSigner = ethers.provider.getSigner();

  before(async function () {
    entryPoint = await deployEntryPoint().then((e) => e.address);
    accounts = await ethers.provider.listAccounts();

    if (accounts.length < 2) this.skip();
    testUtil = await new TestUtil__factory(ethersSigner).deploy();
    accountOwner = createAccountOwner();
  });

  it("owner should be able to call transfer", async () => {
    const { proxy: account } = await createAccount(
      ethers.provider.getSigner(),
      accounts[0],
      entryPoint
    );
    await ethersSigner.sendTransaction({
      from: accounts[0],
      to: account.address,
      value: parseEther("2"),
    });
    await account.execute(accounts[2], ONE_ETH, "0x");
  });
  it("other account should not be able to call transfer", async () => {
    const { proxy: account } = await createAccount(
      ethers.provider.getSigner(),
      accounts[0],
      entryPoint
    );
    await expect(
      account
        .connect(ethers.provider.getSigner(1))
        .execute(accounts[2], ONE_ETH, "0x")
    ).to.be.revertedWith("account: not Owner or EntryPoint");
  });
});
