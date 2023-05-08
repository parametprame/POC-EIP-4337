import { BigNumber, Event, Wallet } from "ethers";
import { expect } from "chai";
import {
  AddressZero,
  createAccountOwner,
  fund,
  checkForGeth,
  rethrow,
  tostr,
  getAccountInitCode,
  calcGasUsage,
  checkForBannedOps,
  ONE_ETH,
  TWO_ETH,
  deployEntryPoint,
  getBalance,
  createAddress,
  getAccountAddress,
  HashZero,
  simulationResultCatch,
  createAccount,
  simulationResultWithAggregationCatch,
  decodeRevertReason,
} from "./testutils";
import { DefaultsForUserOp, fillAndSign, getUserOpHash } from "./UserOp";
import { UserOperation } from "./UserOperation";
import { PopulatedTransaction } from "ethers/lib/ethers";
import { ethers } from "hardhat";
import {
  arrayify,
  defaultAbiCoder,
  hexConcat,
  hexZeroPad,
  parseEther,
} from "ethers/lib/utils";
import { debugTransaction } from "./debugTx";
import { BytesLike } from "@ethersproject/bytes";
import { toChecksumAddress } from "ethereumjs-util";
import {
  EntryPoint,
  SimpleAccount,
  SimpleAccountFactory,
  TestPaymasterAcceptAll,
  TestPaymasterAcceptAll__factory,
  SimpleERC721,
  SimpleERC721__factory,
} from "../typechain";

describe("EntryPoint", function () {
  let entryPoint: EntryPoint;
  let simpleAccountFactory: SimpleAccountFactory;

  let accountOwner: Wallet;
  const ethersSigner = ethers.provider.getSigner();
  let account: SimpleAccount;

  before(async function () {
    const chainId = await ethers.provider
      .getNetwork()
      .then((net) => net.chainId);

    entryPoint = await deployEntryPoint();
    accountOwner = createAccountOwner();

    ({ proxy: account, accountFactory: simpleAccountFactory } =
      await createAccount(
        ethersSigner,
        await accountOwner.getAddress(),
        entryPoint.address
      ));
    await fund(account);

    // sanity: validate helper functions
    const sampleOp = await fillAndSign(
      { sender: account.address },
      accountOwner,
      entryPoint
    );
    expect(getUserOpHash(sampleOp, entryPoint.address, chainId)).to.eql(
      await entryPoint.getUserOpHash(sampleOp)
    );
  });

  describe("paymaster should pay gas fee", () => {
    let accountExecFromEntryPoint: PopulatedTransaction;
    let paymaster: TestPaymasterAcceptAll;
    let nft: SimpleERC721;
    let testAddr: string;

    const account2Owner = createAccountOwner();

    before(async () => {
      paymaster = await new TestPaymasterAcceptAll__factory(
        ethersSigner
      ).deploy(entryPoint.address);

      testAddr = await ethersSigner.getAddress();

      nft = await new SimpleERC721__factory(ethersSigner).deploy();
      const mintNFT = await nft.populateTransaction.mintToken(testAddr, 1);
      accountExecFromEntryPoint = await account.populateTransaction.execute(
        nft.address,
        0,
        mintNFT.data!
      );
    });

    it("should fail if paymaster has no deposit", async function () {
      const op = await fillAndSign(
        {
          paymasterAndData: paymaster.address,
          callData: accountExecFromEntryPoint.data,
          initCode: getAccountInitCode(
            account2Owner.address,
            simpleAccountFactory
          ),

          verificationGasLimit: 3e6,
          callGasLimit: 1e6,
        },
        account2Owner,
        entryPoint
      );
      const beneficiaryAddress = createAddress();
      await expect(
        entryPoint.handleOps([op], beneficiaryAddress)
      ).to.revertedWith('"AA31 paymaster deposit too low"');
    });

    it("paymaster should pay for tx", async function () {
      await paymaster.deposit({ value: ONE_ETH });
      const op = await fillAndSign(
        {
          paymasterAndData: paymaster.address,
          callData: accountExecFromEntryPoint.data,
          initCode: getAccountInitCode(
            account2Owner.address,
            simpleAccountFactory
          ),
        },
        account2Owner,
        entryPoint
      );
      const beneficiaryAddress = createAddress();

      const rcpt = await entryPoint
        .handleOps([op], beneficiaryAddress)
        .then(async (t) => t.wait());

      const { actualGasCost } = await calcGasUsage(
        rcpt,
        entryPoint,
        beneficiaryAddress
      );
      const paymasterPaid = ONE_ETH.sub(
        await entryPoint.balanceOf(paymaster.address)
      );

      expect(paymasterPaid).to.eql(actualGasCost);
    });
  });

  describe("SimulateHandleOp", () => {
    it("should simulate execution", async () => {
      const accountOwner1 = createAccountOwner();
      const { proxy: account } = await createAccount(
        ethersSigner,
        await accountOwner.getAddress(),
        entryPoint.address
      );
      await fund(account);

      const nft = await new SimpleERC721__factory(ethersSigner).deploy();

      const testAddr = await ethersSigner.getAddress();

      const mintNFT = nft.interface.encodeFunctionData("mintToken", [
        testAddr,
        1,
      ]);
      const callData = account.interface.encodeFunctionData("execute", [
        nft.address,
        0,
        mintNFT,
      ]);

      const userOp = await fillAndSign(
        {
          sender: account.address,
          callData,
        },
        accountOwner1,
        entryPoint
      );

      const ret = await entryPoint.callStatic
        .simulateHandleOp(
          userOp,
          nft.address,
          nft.interface.encodeFunctionData("balanceOf", [testAddr])
        )
        .catch((e) => e.errorArgs);

      const [balanceResult] = nft.interface.decodeFunctionResult(
        "balanceOf",
        ret.targetResult
      );

      console.log("amount nft", balanceResult);
    });
  });
});
