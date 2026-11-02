// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {Test} from "forge-std/Test.sol";
import {StdInvariant} from "forge-std/StdInvariant.sol";
import {Rota} from "../src/Rota.sol";

contract RotaHandler is Test {
    Rota public rota;
    address[] public actors;
    uint256 public rotaId;

    uint256 public totalJoined;
    uint256 public totalBond;

    constructor(Rota _rota, address[] memory _actors) {
        rota = _rota;
        actors = _actors;

        for (uint256 i = 0; i < actors.length; i++) {
            vm.deal(actors[i], 100 ether);
        }

        // Create 1 rota with these actors: 3 actors, 3600s, 2 cycles, 1 ether bond, 0.2 ether penalty
        rotaId = rota.create("Invariant Rota", actors, 3600, 2, 1 ether, 0.2 ether);
        totalBond = actors.length * 1 ether;
    }

    function joinActor(uint256 actorIdx) external {
        address actor = actors[actorIdx % actors.length];
        if (!rota.hasJoined(rotaId, actor)) {
            vm.prank(actor);
            try rota.join{value: 1 ether}(rotaId) {
                totalJoined++;
            } catch {}
        }
    }

    function ackDuty(uint256 actorIdx) external {
        address actor = actors[actorIdx % actors.length];
        vm.prank(actor);
        try rota.ack(rotaId) {} catch {}
    }

    function settlePeriod(uint32 p) external {
        try rota.settle(rotaId, p % 6) {} catch {}
    }

    function warpTime(uint32 secondsWarp) external {
        uint256 w = bound(secondsWarp, 1, 3600 * 8);
        vm.warp(block.timestamp + w);
    }

    function exitMember(uint256 actorIdx) external {
        address actor = actors[actorIdx % actors.length];
        vm.prank(actor);
        try rota.exit(rotaId) {} catch {}
    }

    function withdrawActor(uint256 actorIdx) external {
        address actor = actors[actorIdx % actors.length];
        vm.prank(actor);
        try rota.withdraw() {} catch {}
    }
}

contract RotaInvariantTest is StdInvariant, Test {
    Rota public rota;
    RotaHandler public handler;
    address[] public actors;

    function setUp() public {
        rota = new Rota();

        actors.push(address(0x1111));
        actors.push(address(0x2222));
        actors.push(address(0x3333));

        handler = new RotaHandler(rota, actors);
        targetContract(address(handler));
    }

    function invariant_SolvencyBalanceMatchesPendingPlusBonds() public view {
        uint256 sumPending = 0;
        uint256 sumBondLeft = 0;

        for (uint256 i = 0; i < actors.length; i++) {
            sumPending += rota.pending(actors[i]);
            sumBondLeft += rota.bondLeftOf(1, actors[i]);
        }

        assertEq(
            address(rota).balance,
            sumPending + sumBondLeft,
            "Solvency violation: balance must equal sum(pending) + sum(bondLeft)"
        );
    }
}
