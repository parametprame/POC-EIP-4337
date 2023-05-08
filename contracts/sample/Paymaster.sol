// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.12;

/* solhint-disable reason-string */

import "../core/BasePaymaster.sol";

contract Paymaster is BasePaymaster {
    using UserOperationLib for UserOperation;
    //calculated cost of the postOp
    uint256 public constant COST_OF_POST = 15000;

    address public immutable theFactory;

    constructor(
        address accountFactory,
        IEntryPoint _entryPoint
    ) BasePaymaster(_entryPoint) {
        theFactory = accountFactory;
    }

    // when constructing an account, validate constructor code and parameters
    // we trust our factory (and that it doesn't have any other public methods)
    function _validateConstructor(
        UserOperation calldata userOp
    ) internal view virtual {
        address factory = address(bytes20(userOp.initCode[0:20]));
        require(factory == theFactory, "TokenPaymaster: wrong account factory");
    }

    /**
     * validate the request:
     * if this is a constructor call, make sure it is a known account.
     * verify the sender has enough tokens.
     * (since the paymaster is also the token, there is no notion of "approval")
     */
    function _validatePaymasterUserOp(
        UserOperation calldata userOp,
        bytes32 /*userOpHash*/,
        uint256 requiredPreFund
    )
        internal
        view
        override
        returns (bytes memory context, uint256 validationData)
    {
        // verificationGasLimit is dual-purposed, as gas limit for postOp. make sure it is high enough
        // make sure that verificationGasLimit is high enough to handle postOp
        require(
            userOp.verificationGasLimit > COST_OF_POST,
            "TokenPaymaster: gas too low for postOp"
        );

        bytes calldata paymasterAndData = userOp.paymasterAndData;

        require(
            paymasterAndData.length == 20,
            "DepositPaymaster: paymasterAndData must specify address of paymaster"
        );

        address paymaster = address(bytes20(paymasterAndData[:20]));

        require(
            entryPoint.balanceOf(paymaster) >= requiredPreFund,
            "DepositPaymaster: deposit too low"
        );

        return (abi.encode(paymaster), 0);
    }

    function _postOp(
        PostOpMode mode,
        bytes calldata context,
        uint256 actualGasCost
    ) internal pure override {
        //we don't really care about the mode , context, actualGasCost we just support the gas for the users.
        (mode, context, actualGasCost);
    }
}
