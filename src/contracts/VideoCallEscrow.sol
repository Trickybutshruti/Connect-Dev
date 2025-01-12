// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

contract VideoCallEscrow {
    struct Call {
        address client;
        address developer;
        uint256 amount;
        uint256 duration;
        uint256 startTime;
        bool isActive;
        bool isCompleted;
        bool isPaid;
    }

    mapping(bytes32 => Call) public calls;
    address public owner;

    // Events
    event CallCreated(
        bytes32 indexed callId,
        address indexed client,
        address indexed developer,
        uint256 amount,
        uint256 duration,
        uint256 timestamp
    );
    event CallStarted(bytes32 indexed callId, uint256 startTime);
    event CallCompleted(bytes32 indexed callId, uint256 endTime);
    event PaymentReleased(bytes32 indexed callId, address developer, uint256 amount);
    event Debug(string message, bytes32 callId);

    // Custom errors
    error InvalidAmount(uint256 amount);
    error InvalidDuration(uint256 duration);
    error InvalidDeveloper(address developer);
    error CallNotFound(bytes32 callId);
    error CallAlreadyExists(bytes32 callId);
    error CallAlreadyStarted(bytes32 callId);
    error CallAlreadyCompleted(bytes32 callId);
    error Unauthorized(address sender, address expected);
    error SelfBookingNotAllowed(address sender);
    error DurationNotMet(uint256 currentTime, uint256 requiredTime);
    error PaymentFailed(address developer, uint256 amount);

    constructor() {
        owner = msg.sender;
    }

    modifier onlyClient(bytes32 callId) {
        if (calls[callId].client != msg.sender) {
            revert Unauthorized(msg.sender, calls[callId].client);
        }
        _;
    }

    modifier callExists(bytes32 callId) {
        if (calls[callId].client == address(0)) {
            revert CallNotFound(callId);
        }
        _;
    }

    modifier onlyDeveloper(bytes32 callId) {
        if (calls[callId].developer != msg.sender) {
            revert Unauthorized(msg.sender, calls[callId].developer);
        }
        _;
    }

    function createCall(bytes32 callId, address developer, uint256 duration) external payable {
        emit Debug("Creating call", callId);

        // Input validation
        if (msg.value == 0) {
            revert InvalidAmount(msg.value);
        }
        if (duration == 0) {
            revert InvalidDuration(duration);
        }
        if (developer == address(0)) {
            revert InvalidDeveloper(developer);
        }
        if (msg.sender == developer) {
            revert SelfBookingNotAllowed(msg.sender);
        }

        // Check if call already exists
        if (calls[callId].client != address(0)) {
            // If call exists, check if it's completed and not paid
            Call storage existingCall = calls[callId];
            if (!existingCall.isCompleted || existingCall.isPaid) {
                revert CallAlreadyExists(callId);
            }
        }

        // Create new call
        calls[callId] = Call({
            client: msg.sender,
            developer: developer,
            amount: msg.value,
            duration: duration,
            startTime: 0,
            isActive: false,
            isCompleted: false,
            isPaid: false
        });

        emit CallCreated(
            callId,
            msg.sender,
            developer,
            msg.value,
            duration,
            block.timestamp
        );
    }

    function startCall(bytes32 callId) external callExists(callId) {
        emit Debug("Starting call", callId);
        
        Call storage call = calls[callId];
        
        if (call.isActive) {
            revert CallAlreadyStarted(callId);
        }
        if (call.isCompleted) {
            revert CallAlreadyCompleted(callId);
        }

        call.isActive = true;
        call.startTime = block.timestamp;

        emit CallStarted(callId, block.timestamp);
    }

    function completeCall(bytes32 callId) external callExists(callId) onlyDeveloper(callId) {
        emit Debug("Completing call", callId);

        Call storage call = calls[callId];
        
        if (call.isCompleted) {
            revert CallAlreadyCompleted(callId);
        }

        if (call.isPaid) {
            revert("Payment already released");
        }

        // Store amount before any state changes
        uint256 amount = call.amount;
        if (amount == 0) {
            revert("No payment amount available");
        }

        // Verify contract has enough balance
        if (address(this).balance < amount) {
            revert("Insufficient contract balance");
        }

        // Log values for debugging
        emit Debug(string(abi.encodePacked(
            "Call status: client=", toHexString(call.client),
            ", developer=", toHexString(call.developer),
            ", amount=", toString(amount)
        )), callId);

        // Update state before transfer
        call.isCompleted = true;
        call.isPaid = true;
        call.amount = 0; // Clear amount to prevent reentrancy

        // Transfer the payment
        (bool success, ) = call.developer.call{value: amount}("");
        if (!success) {
            revert PaymentFailed(call.developer, amount);
        }

        emit CallCompleted(callId, block.timestamp);
        emit PaymentReleased(callId, call.developer, amount);
    }

    function getCallDetails(bytes32 callId) external view returns (
        address client,
        address developer,
        uint256 amount,
        uint256 duration,
        uint256 startTime,
        bool isActive,
        bool isCompleted,
        bool isPaid
    ) {
        Call storage call = calls[callId];
        if (call.client == address(0)) {
            revert CallNotFound(callId);
        }
        
        return (
            call.client,
            call.developer,
            call.amount,
            call.duration,
            call.startTime,
            call.isActive,
            call.isCompleted,
            call.isPaid
        );
    }

    function doesCallExist(bytes32 callId) external view returns (bool) {
        return calls[callId].client != address(0);
    }

    // Helper function to convert uint to string
    function toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }

    // Helper function to convert address to hex string
    function toHexString(address addr) internal pure returns (string memory) {
        bytes memory buffer = new bytes(42);
        buffer[0] = '0';
        buffer[1] = 'x';
        for (uint256 i = 0; i < 20; i++) {
            uint8 b = uint8(uint160(addr) / (2**(8*(19 - i))));
            buffer[2+i*2] = toHexChar(b / 16);
            buffer[2+i*2+1] = toHexChar(b % 16);
        }
        return string(buffer);
    }

    function toHexChar(uint8 b) internal pure returns (bytes1) {
        if (b < 10) return bytes1(b + 48);
        else return bytes1(b + 87);
    }
}