// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

/**
 * @title Rota
 * @notice A rotating duty roster with skin in the game.
 * Take turns being on call. Miss yours and it costs you.
 */
contract Rota {
    // --- Constants ---
    uint256 public constant MIN_MEMBERS = 2;
    uint256 public constant MAX_MEMBERS = 8;
    uint32 public constant MIN_PERIOD = 3600; // 1 hour
    uint32 public constant MAX_PERIOD = 2592000; // 30 days
    uint8 public constant MIN_CYCLES = 1;
    uint8 public constant MAX_CYCLES = 12;
    uint64 public constant JOIN_WINDOW = 604800; // 7 days
    uint256 public constant MAX_BATCH = 50;
    uint256 public constant MAX_NAME_BYTES = 40;

    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;

    // --- Custom Errors ---
    error BadName();
    error BadMembers();
    error BadPeriod();
    error BadCycles();
    error BadBond();
    error NotMember();
    error AlreadyJoined();
    error WrongBond(uint128 requiredBond);
    error NotStarted();
    error AlreadyStarted();
    error Over();
    error NotOnDuty(address expected);
    error AlreadyAcked();
    error NotEnded();
    error AlreadySettled();
    error NotSettled();
    error JoinWindowActive();
    error AlreadyExited();
    error NothingToWithdraw();
    error NotFound();
    error TransferFailed();
    error REENTRANCY();

    // --- Structs ---
    struct RotaInfo {
        uint64 createdAt; // join window = 7 days from here
        uint64 startedAt; // 0 until every member has joined
        uint32 periodSecs; // 1 hour..30 days
        uint8 memberCount; // 2..8
        uint8 cycles; // 1..12
        uint8 joined;
        uint128 bond;
        uint128 penalty; // penalty <= bond
        string name; // <= 40 bytes
    }

    // --- Events ---
    event Created(uint256 indexed id, address indexed creator, string name);
    event Joined(uint256 indexed id, address indexed member);
    event Acked(uint256 indexed id, uint32 indexed p, address indexed member);
    event Missed(
        uint256 indexed id,
        uint32 indexed p,
        address indexed member,
        uint128 penaltyAmount,
        address nextMember
    );
    event Exited(uint256 indexed id, address indexed member, uint128 amount);
    event Withdrawn(address indexed recipient, uint256 amount);

    // --- Storage ---
    mapping(uint256 => RotaInfo) private _rotas;
    mapping(uint256 => address[]) private _members;
    mapping(uint256 => mapping(address => bool)) private _isMember;
    mapping(uint256 => mapping(address => bool)) private _hasJoined;
    mapping(uint256 => mapping(address => uint128)) private _bondLeft;
    mapping(uint256 => mapping(address => bool)) private _hasExited;
    mapping(uint256 => mapping(uint32 => uint8)) private _periodState; // 0 open, 1 acked, 2 missed-settled

    mapping(address => uint256) public pending;
    uint256 public rotaCount;

    uint256 private _status = _NOT_ENTERED;

    modifier nonReentrant() {
        if (_status == _ENTERED) revert REENTRANCY();
        _status = _ENTERED;
        _;
        _status = _NOT_ENTERED;
    }

    /**
     * @notice Creates a new duty rota.
     */
    function create(
        string calldata name,
        address[] calldata members,
        uint32 periodSecs,
        uint8 cycles,
        uint128 bond,
        uint128 penalty
    ) external returns (uint256 id) {
        bytes memory nameBytes = bytes(name);
        if (nameBytes.length == 0 || nameBytes.length > MAX_NAME_BYTES) {
            revert BadName();
        }

        uint256 mLen = members.length;
        if (mLen < MIN_MEMBERS || mLen > MAX_MEMBERS) {
            revert BadMembers();
        }

        for (uint256 i = 0; i < mLen; i++) {
            address m = members[i];
            if (m == address(0)) revert BadMembers();
            for (uint256 j = i + 1; j < mLen; j++) {
                if (m == members[j]) revert BadMembers();
            }
        }

        if (periodSecs < MIN_PERIOD || periodSecs > MAX_PERIOD) {
            revert BadPeriod();
        }

        if (cycles < MIN_CYCLES || cycles > MAX_CYCLES) {
            revert BadCycles();
        }

        if (bond == 0 || penalty == 0 || penalty > bond) {
            revert BadBond();
        }

        id = ++rotaCount;
        RotaInfo storage r = _rotas[id];
        r.createdAt = uint64(block.timestamp);
        r.startedAt = 0;
        r.periodSecs = periodSecs;
        r.memberCount = uint8(mLen);
        r.cycles = cycles;
        r.joined = 0;
        r.bond = bond;
        r.penalty = penalty;
        r.name = name;

        for (uint256 i = 0; i < mLen; i++) {
            _members[id].push(members[i]);
            _isMember[id][members[i]] = true;
        }

        emit Created(id, msg.sender, name);
    }

    /**
     * @notice Enrolls as a designated member by depositing the required bond.
     */
    function join(uint256 id) external payable {
        if (id == 0 || id > rotaCount) revert NotFound();
        RotaInfo storage r = _rotas[id];

        if (!_isMember[id][msg.sender]) revert NotMember();
        if (_hasJoined[id][msg.sender]) revert AlreadyJoined();
        if (msg.value != r.bond) revert WrongBond(r.bond);

        _hasJoined[id][msg.sender] = true;
        _bondLeft[id][msg.sender] = r.bond;
        r.joined++;

        emit Joined(id, msg.sender);

        if (r.joined == r.memberCount) {
            r.startedAt = uint64(block.timestamp);
        }
    }

    /**
     * @notice Member on duty checks in during their active period.
     */
    function ack(uint256 id) external {
        if (id == 0 || id > rotaCount) revert NotFound();
        RotaInfo storage r = _rotas[id];

        if (r.startedAt == 0) revert NotStarted();

        (bool started, uint32 p, address onDutyMember, ) = currentPeriod(id);
        if (!started) revert NotStarted();

        uint32 totalPeriods = uint32(r.memberCount) * uint32(r.cycles);
        if (p >= totalPeriods) revert Over();

        if (msg.sender != onDutyMember) revert NotOnDuty(onDutyMember);

        if (_periodState[id][p] != 0) revert AlreadyAcked();

        _periodState[id][p] = 1; // Acked
        emit Acked(id, p, msg.sender);
    }

    /**
     * @notice Settles a missed period once its duration has elapsed.
     */
    function settle(uint256 id, uint32 p) external {
        if (id == 0 || id > rotaCount) revert NotFound();
        RotaInfo storage r = _rotas[id];

        if (r.startedAt == 0) revert NotStarted();

        uint32 totalPeriods = uint32(r.memberCount) * uint32(r.cycles);
        if (p >= totalPeriods) revert Over();

        uint256 periodEnd = uint256(r.startedAt) + (uint256(p) + 1) * uint256(r.periodSecs);
        if (block.timestamp < periodEnd) revert NotEnded();

        if (_periodState[id][p] != 0) revert AlreadySettled();

        _periodState[id][p] = 2; // Missed & settled

        address dutyMember = _members[id][p % r.memberCount];
        address nextMember = _members[id][(p + 1) % r.memberCount];

        uint128 bLeft = _bondLeft[id][dutyMember];
        uint128 penaltyAmt = r.penalty;
        if (bLeft < penaltyAmt) {
            penaltyAmt = bLeft;
        }

        if (penaltyAmt > 0) {
            _bondLeft[id][dutyMember] -= penaltyAmt;
            pending[nextMember] += penaltyAmt;
        }

        emit Missed(id, p, dutyMember, penaltyAmt, nextMember);
    }

    /**
     * @notice Exits a rota, reclaiming any remaining bond.
     */
    function exit(uint256 id) external {
        if (id == 0 || id > rotaCount) revert NotFound();
        RotaInfo storage r = _rotas[id];

        if (!_isMember[id][msg.sender]) revert NotMember();
        if (!_hasJoined[id][msg.sender]) revert NotMember();
        if (_hasExited[id][msg.sender]) revert AlreadyExited();

        if (r.startedAt == 0) {
            // Unstarted rota: can exit only after join window expires (7 days)
            if (block.timestamp < uint256(r.createdAt) + JOIN_WINDOW) {
                revert JoinWindowActive();
            }
        } else {
            // Started rota: all periods must have ended and been settled
            uint32 totalPeriods = uint32(r.memberCount) * uint32(r.cycles);
            uint256 allEnd = uint256(r.startedAt) + uint256(totalPeriods) * uint256(r.periodSecs);
            if (block.timestamp < allEnd) revert NotEnded();

            for (uint32 i = 0; i < totalPeriods; i++) {
                if (_periodState[id][i] == 0) revert NotSettled();
            }
        }

        _hasExited[id][msg.sender] = true;
        uint128 amt = _bondLeft[id][msg.sender];
        _bondLeft[id][msg.sender] = 0;

        if (amt > 0) {
            pending[msg.sender] += amt;
        }

        emit Exited(id, msg.sender, amt);
    }

    /**
     * @notice Pull payment withdrawal for accrued pending balances.
     */
    function withdraw() external nonReentrant {
        uint256 amt = pending[msg.sender];
        if (amt == 0) revert NothingToWithdraw();

        pending[msg.sender] = 0;

        (bool success, ) = msg.sender.call{value: amt}("");
        if (!success) revert TransferFailed();

        emit Withdrawn(msg.sender, amt);
    }

    // --- View Functions ---

    function rotaOf(uint256 id) external view returns (RotaInfo memory) {
        if (id == 0 || id > rotaCount) revert NotFound();
        return _rotas[id];
    }

    function membersOf(uint256 id) external view returns (address[] memory) {
        if (id == 0 || id > rotaCount) revert NotFound();
        return _members[id];
    }

    function bondLeftOf(uint256 id, address who) external view returns (uint128) {
        if (id == 0 || id > rotaCount) revert NotFound();
        return _bondLeft[id][who];
    }

    function hasJoined(uint256 id, address who) external view returns (bool) {
        if (id == 0 || id > rotaCount) revert NotFound();
        return _hasJoined[id][who];
    }

    function hasExited(uint256 id, address who) external view returns (bool) {
        if (id == 0 || id > rotaCount) revert NotFound();
        return _hasExited[id][who];
    }

    function periodState(uint256 id, uint32 p) external view returns (uint8) {
        if (id == 0 || id > rotaCount) revert NotFound();
        return _periodState[id][p];
    }

    function currentPeriod(
        uint256 id
    ) public view returns (bool started, uint32 p, address onDuty, uint64 endsAt) {
        if (id == 0 || id > rotaCount) revert NotFound();
        RotaInfo storage r = _rotas[id];

        if (r.startedAt == 0) {
            return (false, 0, address(0), 0);
        }

        started = true;
        uint256 elapsed = block.timestamp - r.startedAt;
        uint256 pIndex = elapsed / r.periodSecs;
        uint32 totalPeriods = uint32(r.memberCount) * uint32(r.cycles);

        if (pIndex >= totalPeriods) {
            p = totalPeriods;
            onDuty = address(0);
            endsAt = uint64(uint256(r.startedAt) + uint256(totalPeriods) * uint256(r.periodSecs));
            return (true, p, onDuty, endsAt);
        }

        p = uint32(pIndex);
        onDuty = _members[id][p % r.memberCount];
        endsAt = uint64(uint256(r.startedAt) + (uint256(p) + 1) * uint256(r.periodSecs));
    }

    function latest(
        uint256 offset,
        uint256 count
    ) external view returns (RotaInfo[] memory) {
        if (count > MAX_BATCH) count = MAX_BATCH;
        if (offset >= rotaCount) return new RotaInfo[](0);

        uint256 end = offset + count;
        if (end > rotaCount) end = rotaCount;
        uint256 size = end - offset;

        RotaInfo[] memory batch = new RotaInfo[](size);
        for (uint256 i = 0; i < size; i++) {
            batch[i] = _rotas[offset + i + 1];
        }
        return batch;
    }

    function byMember(address member) external view returns (uint256[] memory) {
        uint256 matchCount = 0;
        for (uint256 i = 1; i <= rotaCount; i++) {
            if (_isMember[i][member]) {
                matchCount++;
            }
        }

        uint256[] memory ids = new uint256[](matchCount);
        uint256 idx = 0;
        for (uint256 i = 1; i <= rotaCount; i++) {
            if (_isMember[i][member]) {
                ids[idx++] = i;
            }
        }
        return ids;
    }
}
