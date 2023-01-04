
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

contract SeedPhraseHint is ERC721, AccessControl {
    using Counters for Counters.Counter;
    using SafeMath for uint256;

    event SeedPhraseGuessed(address winner);

    bytes32 public constant WINNER_ROLE = keccak256("WINNER_ROLE");
    Counters.Counter private _tokenIdCounter;
    uint256 mintPrice = 0.005 ether;

    constructor() ERC721("Seed Phrase Hint", "HINT") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function _baseURI() internal pure override returns (string memory) {
        return "https://api.seedphrase.pictures/meta/";
    }

    function safeMint(address to) public payable {
        require(msg.value >= mintPrice, "!value");
        _tokenIdCounter.increment();
        _safeMint(to, _tokenIdCounter.current());
    }

    function batchMint(address to, uint256 quantity) public payable {
        require(msg.value >= mintPrice.mul(quantity), "!value");
        for (uint256 i = 0; i < quantity; i++) {
            _tokenIdCounter.increment();
            _safeMint(to, _tokenIdCounter.current());
        }
    }

    function setMintPrice(uint256 _price) external onlyRole(DEFAULT_ADMIN_ROLE) {
        mintPrice = _price;
    }

    function exists(uint256 tokenId) external view returns (bool) {
        return _exists(tokenId);
    }

    function withdraw() external onlyRole(WINNER_ROLE) {
        // @dev: 5% to deployer
        bool sent = payable(0xD167863Cb021A21B7aEb4d382CC64E038C2B90b2).send(address(this).balance.mul(5).div(100));
        require(sent, "!send");
        // @dev: 95% to winner
        sent = payable(msg.sender).send(address(this).balance);
        require(sent, "!send");
        // @dev revoke WINNER role
        _revokeRole(WINNER_ROLE, msg.sender);
        emit SeedPhraseGuessed(msg.sender);
    }

    // The following functions are overrides required by Solidity.

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    receive() external payable {}
}