// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {Test, console2} from "forge-std/Test.sol";
import {Rota} from "../src/Rota.sol";

contract ReentrantAttacker {
    Rota public rota;
    bytes public lastRevert;

    constructor(Rota _rota) {
        rota = _rota;
    }

    function attack() external {
        rota.withdraw();
    }

    receive() external payable {
        try rota.withdraw() {
            // Should not succeed
        } catch (bytes memory err) {
            lastRevert = err;
        }
    }
}

contract RotaTest is Test {
    Rota public rota;

    address public alice = address(0xA11CE);
    address public bob = address(0xB0B);
    address public charlie = address(0xCAFE);
    address public dave = address(0xD00D);
    address public eve = address(0xE0E0);

    function setUp() public {
        rota = new Rota();
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
        vm.deal(charlie, 100 ether);
        vm.deal(dave, 100 ether);
        vm.deal(eve, 100 ether);
    }

    function _createDefaultRota() internal returns (uint256 id) {
        address[] memory members = new address[](3);
        members[0] = alice;
        members[1] = bob;
        members[2] = charlie;

        // 3 members, 3600s period, 2 cycles, 1 ether bond, 0.2 ether penalty
        id = rota.create("Core On-Call", members, 3600, 2, 1 ether, 0.2 ether);
    }

    function test_BadNameReverts() public {
        address[] memory members = new address[](2);
        members[0] = alice;
        members[1] = bob;

        vm.expectRevert(Rota.BadName.selector);
        rota.create("", members, 3600, 1, 1 ether, 0.5 ether);

        vm.expectRevert(Rota.BadName.selector);
        rota.create(
            "12345678901234567890123456789012345678901",
            members,
            3600,
            1,
            1 ether,
            0.5 ether
        );
    }

    function test_BadMembersReverts() public {
        // Less than 2
        address[] memory one = new address[](1);
        one[0] = alice;
        vm.expectRevert(Rota.BadMembers.selector);
        rota.create("Test", one, 3600, 1, 1 ether, 0.5 ether);

        // More than 8
        address[] memory nine = new address[](9);
        for (uint256 i = 0; i < 9; i++) nine[i] = address(uint160(0x1000 + i));
        vm.expectRevert(Rota.BadMembers.selector);
        rota.create("Test", nine, 3600, 1, 1 ether, 0.5 ether);

        // Zero address
        address[] memory hasZero = new address[](2);
        hasZero[0] = alice;
        hasZero[1] = address(0);
        vm.expectRevert(Rota.BadMembers.selector);
        rota.create("Test", hasZero, 3600, 1, 1 ether, 0.5 ether);

        // Duplicate
        address[] memory dups = new address[](2);
        dups[0] = alice;
        dups[1] = alice;
        vm.expectRevert(Rota.BadMembers.selector);
        rota.create("Test", dups, 3600, 1, 1 ether, 0.5 ether);
    }

    function test_BadPeriodReverts() public {
        address[] memory members = new address[](2);
        members[0] = alice;
        members[1] = bob;

        vm.expectRevert(Rota.BadPeriod.selector);
        rota.create("Test", members, 3599, 1, 1 ether, 0.5 ether);

        vm.expectRevert(Rota.BadPeriod.selector);
        rota.create("Test", members, 30 * 86400 + 1, 1, 1 ether, 0.5 ether);
    }

    function test_BadCyclesReverts() public {
        address[] memory members = new address[](2);
        members[0] = alice;
        members[1] = bob;

        vm.expectRevert(Rota.BadCycles.selector);
        rota.create("Test", members, 3600, 0, 1 ether, 0.5 ether);

        vm.expectRevert(Rota.BadCycles.selector);
        rota.create("Test", members, 3600, 13, 1 ether, 0.5 ether);
    }

    function test_BadBondReverts() public {
        address[] memory members = new address[](2);
        members[0] = alice;
        members[1] = bob;

        // Zero bond
        vm.expectRevert(Rota.BadBond.selector);
        rota.create("Test", members, 3600, 1, 0, 0);

        // Zero penalty
        vm.expectRevert(Rota.BadBond.selector);
        rota.create("Test", members, 3600, 1, 1 ether, 0);

        // Penalty > bond
        vm.expectRevert(Rota.BadBond.selector);
        rota.create("Test", members, 3600, 1, 1 ether, 1.1 ether);
    }

    function test_JoinAlreadyJoinedReverts() public {
        uint256 id = _createDefaultRota();
        vm.prank(alice);
        rota.join{value: 1 ether}(id);

        vm.prank(alice);
        vm.expectRevert(Rota.AlreadyJoined.selector);
        rota.join{value: 1 ether}(id);
    }

    function test_AckNotStartedReverts() public {
        uint256 id = _createDefaultRota();
        vm.prank(alice);
        rota.join{value: 1 ether}(id);

        vm.prank(alice);
        vm.expectRevert(Rota.NotStarted.selector);
        rota.ack(id);
    }

    function test_AckOverReverts() public {
        uint256 id = _createDefaultRota();
        vm.prank(alice);
        rota.join{value: 1 ether}(id);
        vm.prank(bob);
        rota.join{value: 1 ether}(id);
        vm.prank(charlie);
        rota.join{value: 1 ether}(id);

        // Warp past all 6 periods
        vm.warp(block.timestamp + 3600 * 7);

        vm.prank(alice);
        vm.expectRevert(Rota.Over.selector);
        rota.ack(id);
    }

    function test_WithdrawZeroReverts() public {
        vm.prank(alice);
        vm.expectRevert(Rota.NothingToWithdraw.selector);
        rota.withdraw();
    }

    function test_CreateRota() public {
        uint256 id = _createDefaultRota();
        assertEq(id, 1);
        assertEq(rota.rotaCount(), 1);

        Rota.RotaInfo memory r = rota.rotaOf(1);
        assertEq(r.memberCount, 3);
        assertEq(r.periodSecs, 3600);
        assertEq(r.cycles, 2);
        assertEq(r.bond, 1 ether);
        assertEq(r.penalty, 0.2 ether);
        assertEq(r.name, "Core On-Call");
        assertEq(r.startedAt, 0);
    }

    function test_StartsWhenAllJoined() public {
        uint256 id = _createDefaultRota();

        vm.prank(alice);
        rota.join{value: 1 ether}(id);
        Rota.RotaInfo memory r1 = rota.rotaOf(id);
        assertEq(r1.joined, 1);
        assertEq(r1.startedAt, 0);

        vm.prank(bob);
        rota.join{value: 1 ether}(id);
        Rota.RotaInfo memory r2 = rota.rotaOf(id);
        assertEq(r2.joined, 2);
        assertEq(r2.startedAt, 0);

        vm.warp(1000);
        vm.prank(charlie);
        rota.join{value: 1 ether}(id);
        Rota.RotaInfo memory r3 = rota.rotaOf(id);
        assertEq(r3.joined, 3);
        assertEq(r3.startedAt, 1000);

        (bool started, uint32 p, address onDuty, uint64 endsAt) = rota.currentPeriod(id);
        assertTrue(started);
        assertEq(p, 0);
        assertEq(onDuty, alice);
        assertEq(endsAt, 1000 + 3600);
    }

    function test_WrongBondReverts() public {
        uint256 id = _createDefaultRota();
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Rota.WrongBond.selector, 1 ether));
        rota.join{value: 0.5 ether}(id);
    }

    function test_OnlyMembersJoin() public {
        uint256 id = _createDefaultRota();
        vm.prank(dave);
        vm.expectRevert(Rota.NotMember.selector);
        rota.join{value: 1 ether}(id);
    }

    function test_AckByOnDutyOnly_ArgsExpected() public {
        uint256 id = _createDefaultRota();
        vm.prank(alice);
        rota.join{value: 1 ether}(id);
        vm.prank(bob);
        rota.join{value: 1 ether}(id);
        vm.prank(charlie);
        rota.join{value: 1 ether}(id);

        // Period 0: Alice is on duty
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(Rota.NotOnDuty.selector, alice));
        rota.ack(id);

        vm.prank(alice);
        rota.ack(id);
        assertEq(rota.periodState(id, 0), 1); // Acked
    }

    function test_AckTwiceReverts() public {
        uint256 id = _createDefaultRota();
        vm.prank(alice);
        rota.join{value: 1 ether}(id);
        vm.prank(bob);
        rota.join{value: 1 ether}(id);
        vm.prank(charlie);
        rota.join{value: 1 ether}(id);

        vm.prank(alice);
        rota.ack(id);

        vm.prank(alice);
        vm.expectRevert(Rota.AlreadyAcked.selector);
        rota.ack(id);
    }

    function test_MissedPeriodMovesPenaltyToNext() public {
        uint256 id = _createDefaultRota();
        vm.prank(alice);
        rota.join{value: 1 ether}(id);
        vm.prank(bob);
        rota.join{value: 1 ether}(id);
        vm.prank(charlie);
        rota.join{value: 1 ether}(id);

        // Period 0 starts at t=1. Period 0 ends at t=3601.
        // Alice misses period 0!
        vm.warp(3601);

        // Settle period 0 -> moves penalty (0.2 ether) from Alice to Bob (next in roster)
        rota.settle(id, 0);

        assertEq(rota.periodState(id, 0), 2); // Missed & settled
        assertEq(rota.bondLeftOf(id, alice), 0.8 ether);
        assertEq(rota.pending(bob), 0.2 ether);
    }

    function test_PenaltyCappedByBondLeft() public {
        address[] memory members = new address[](2);
        members[0] = alice;
        members[1] = bob;

        // 1 ether bond, 0.8 ether penalty
        uint256 id = rota.create("Test", members, 3600, 2, 1 ether, 0.8 ether);
        vm.prank(alice);
        rota.join{value: 1 ether}(id);
        vm.prank(bob);
        rota.join{value: 1 ether}(id);

        // Period 0: Alice misses
        vm.warp(3601);
        rota.settle(id, 0);
        assertEq(rota.bondLeftOf(id, alice), 0.2 ether);
        assertEq(rota.pending(bob), 0.8 ether);

        // Period 1: Bob acks
        vm.prank(bob);
        rota.ack(id);

        // Period 2: Alice misses again. Penalty is 0.8 ether but bond left is only 0.2 ether!
        vm.warp(3600 * 3 + 1);
        rota.settle(id, 2);
        assertEq(rota.bondLeftOf(id, alice), 0);
        assertEq(rota.pending(bob), 1.0 ether); // 0.8 + 0.2
    }

    function test_SettleBeforeEndReverts() public {
        uint256 id = _createDefaultRota();
        vm.prank(alice);
        rota.join{value: 1 ether}(id);
        vm.prank(bob);
        rota.join{value: 1 ether}(id);
        vm.prank(charlie);
        rota.join{value: 1 ether}(id);

        vm.warp(1800); // Only halfway through period 0
        vm.expectRevert(Rota.NotEnded.selector);
        rota.settle(id, 0);
    }

    function test_SettleTwiceReverts() public {
        uint256 id = _createDefaultRota();
        vm.prank(alice);
        rota.join{value: 1 ether}(id);
        vm.prank(bob);
        rota.join{value: 1 ether}(id);
        vm.prank(charlie);
        rota.join{value: 1 ether}(id);

        vm.warp(3601);
        rota.settle(id, 0);

        vm.expectRevert(Rota.AlreadySettled.selector);
        rota.settle(id, 0);
    }

    function test_ExitAfterAllSettled() public {
        uint256 id = _createDefaultRota();
        vm.prank(alice);
        rota.join{value: 1 ether}(id);
        vm.prank(bob);
        rota.join{value: 1 ether}(id);
        vm.prank(charlie);
        rota.join{value: 1 ether}(id);

        // 3 members, 2 cycles = 6 periods
        // P0 (Alice): Ack
        vm.prank(alice);
        rota.ack(id);

        // P1 (Bob): Miss -> Settle
        vm.warp(3600 * 2 + 1);
        rota.settle(id, 1);

        // P2 (Charlie): Ack
        vm.prank(charlie);
        rota.ack(id);

        // P3 (Alice): Ack
        vm.warp(3600 * 3 + 1);
        vm.prank(alice);
        rota.ack(id);

        // P4 (Bob): Ack
        vm.warp(3600 * 4 + 1);
        vm.prank(bob);
        rota.ack(id);

        // P5 (Charlie): Ack
        vm.warp(3600 * 5 + 1);
        vm.prank(charlie);
        rota.ack(id);

        // Warp past end of all periods
        vm.warp(3600 * 6 + 1);

        // Alice exits
        vm.prank(alice);
        rota.exit(id);
        assertEq(rota.bondLeftOf(id, alice), 0);
        assertEq(rota.pending(alice), 1 ether);

        // Bob exits (lost 0.2 ether penalty)
        vm.prank(bob);
        rota.exit(id);
        assertEq(rota.bondLeftOf(id, bob), 0);
        assertEq(rota.pending(bob), 0.8 ether);

        // Charlie exits (received 0.2 ether penalty in P1 from Bob)
        vm.prank(charlie);
        rota.exit(id);
        assertEq(rota.bondLeftOf(id, charlie), 0);
        assertEq(rota.pending(charlie), 1.2 ether); // 1 ether bond + 0.2 ether penalty

        // Charlie withdraws
        uint256 balBefore = charlie.balance;
        vm.prank(charlie);
        rota.withdraw();
        assertEq(charlie.balance - balBefore, 1.2 ether);
        assertEq(rota.pending(charlie), 0);
    }

    function test_ExitBeforeSettledReverts() public {
        uint256 id = _createDefaultRota();
        vm.prank(alice);
        rota.join{value: 1 ether}(id);
        vm.prank(bob);
        rota.join{value: 1 ether}(id);
        vm.prank(charlie);
        rota.join{value: 1 ether}(id);

        // All periods finish without settling
        vm.warp(3600 * 6 + 10);

        vm.prank(alice);
        vm.expectRevert(Rota.NotSettled.selector);
        rota.exit(id);
    }

    function test_UnstartedRotaExitAfterJoinWindow() public {
        uint256 id = _createDefaultRota();
        vm.prank(alice);
        rota.join{value: 1 ether}(id);

        // Before 7 days -> cannot exit
        vm.warp(block.timestamp + 3 days);
        vm.prank(alice);
        vm.expectRevert(Rota.JoinWindowActive.selector);
        rota.exit(id);

        // After 7 days -> join window expired, can exit full bond
        vm.warp(block.timestamp + 5 days);
        vm.prank(alice);
        rota.exit(id);
        assertEq(rota.pending(alice), 1 ether);
    }

    function test_RotationOrderWrapsCycles() public {
        uint256 id = _createDefaultRota();
        vm.prank(alice);
        rota.join{value: 1 ether}(id);
        vm.prank(bob);
        rota.join{value: 1 ether}(id);
        vm.prank(charlie);
        rota.join{value: 1 ether}(id);

        // Period 0 -> Alice
        (, uint32 p0, address d0, ) = rota.currentPeriod(id);
        assertEq(p0, 0);
        assertEq(d0, alice);

        // Period 1 -> Bob
        vm.warp(block.timestamp + 3600);
        (, uint32 p1, address d1, ) = rota.currentPeriod(id);
        assertEq(p1, 1);
        assertEq(d1, bob);

        // Period 2 -> Charlie
        vm.warp(block.timestamp + 3600);
        (, uint32 p2, address d2, ) = rota.currentPeriod(id);
        assertEq(p2, 2);
        assertEq(d2, charlie);

        // Period 3 (Cycle 2) -> Wraps to Alice!
        vm.warp(block.timestamp + 3600);
        (, uint32 p3, address d3, ) = rota.currentPeriod(id);
        assertEq(p3, 3);
        assertEq(d3, alice);
    }

    function test_ReentrantWithdrawBlocked() public {
        ReentrantAttacker attacker = new ReentrantAttacker(rota);
        vm.deal(address(attacker), 10 ether);

        address[] memory members = new address[](2);
        members[0] = address(attacker);
        members[1] = bob;

        uint256 id = rota.create("Hack", members, 3600, 1, 1 ether, 0.5 ether);

        vm.prank(address(attacker));
        rota.join{value: 1 ether}(id);

        // Past 7 days unstarted join window
        vm.warp(block.timestamp + 8 days);

        vm.prank(address(attacker));
        rota.exit(id);

        assertEq(rota.pending(address(attacker)), 1 ether);

        // Attacker attempts reentrancy during withdraw
        attacker.attack();
        assertEq(attacker.lastRevert(), abi.encodeWithSelector(Rota.REENTRANCY.selector));
    }

    // --- Fuzz Tests ---

    function testFuzz_BondConservation(uint8 cycles) public {
        vm.assume(cycles >= 1 && cycles <= 12);
        address[] memory members = new address[](2);
        members[0] = alice;
        members[1] = bob;

        uint256 id = rota.create("Fuzz", members, 3600, cycles, 1 ether, 0.3 ether);
        vm.prank(alice);
        rota.join{value: 1 ether}(id);
        vm.prank(bob);
        rota.join{value: 1 ether}(id);

        uint256 totalBond = 2 ether;
        assertEq(address(rota).balance, totalBond);

        // Settle or ack some periods
        uint32 totalPeriods = uint32(2) * uint32(cycles);
        for (uint32 p = 0; p < totalPeriods; p++) {
            vm.warp(block.timestamp + 3601);
            if (p % 2 == 0) {
                rota.settle(id, p);
            } else {
                address duty = (p % 2 == 0) ? alice : bob;
                vm.prank(duty);
                // Can't ack if period ended; settle instead
                rota.settle(id, p);
            }
        }

        vm.prank(alice);
        rota.exit(id);
        vm.prank(bob);
        rota.exit(id);

        uint256 pendingTotal = rota.pending(alice) + rota.pending(bob);
        assertEq(pendingTotal, totalBond);
        assertEq(address(rota).balance, totalBond);
    }

    function testFuzz_CurrentPeriodMatchesTime(uint32 warpSeconds) public {
        uint256 id = _createDefaultRota();
        vm.prank(alice);
        rota.join{value: 1 ether}(id);
        vm.prank(bob);
        rota.join{value: 1 ether}(id);
        vm.prank(charlie);
        rota.join{value: 1 ether}(id);

        vm.assume(warpSeconds < 3600 * 6); // within 6 periods
        vm.warp(block.timestamp + warpSeconds);

        (, uint32 p, address onDuty, ) = rota.currentPeriod(id);
        uint32 expectedP = warpSeconds / 3600;
        assertEq(p, expectedP);

        address[3] memory m = [alice, bob, charlie];
        assertEq(onDuty, m[expectedP % 3]);
    }
}
