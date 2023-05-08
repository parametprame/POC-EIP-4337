//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";

contract SimpleERC721 is ERC721Enumerable {
    using Strings for uint256;

    string public baseURI =
        "ipfs://QmYuooZLrfDFY1P5CSfpr5SCj2UiLejdLpJUtfxsS87L9T/";
    string public baseExtension = ".json";

    constructor() ERC721("SIMPLE TWO", "SMT") {}

    // external
    function mintToken(address minter, uint256 tokenId) external {
        _safeMint(minter, tokenId);
    }

    function walletOfOwner(
        address _owner
    ) public view returns (uint256[] memory) {
        uint256 ownerTokenCount = balanceOf(_owner);
        uint256[] memory tokenIds = new uint256[](ownerTokenCount);
        for (uint256 i; i < ownerTokenCount; i++) {
            tokenIds[i] = tokenOfOwnerByIndex(_owner, i);
        }
        return tokenIds;
    }

    function tokenURI(
        uint256 tokenId
    ) public view virtual override returns (string memory) {
        require(
            _exists(tokenId),
            "ERC721Metadata: URI query for nonexistent token"
        );

        string memory currentBaseURI = _baseURI();
        return
            bytes(currentBaseURI).length > 0
                ? string(
                    abi.encodePacked(
                        currentBaseURI,
                        tokenId.toString(),
                        baseExtension
                    )
                )
                : "";
    }

    // internal
    function _baseURI() internal view virtual override returns (string memory) {
        return baseURI;
    }
}
