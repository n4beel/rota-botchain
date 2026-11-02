import os
import subprocess
import sys

ORIGINAL_SOL = "contracts/src/Rota.sol"
BACKUP_SOL = "contracts/src/Rota.sol.orig"

mutants = [
    # M01: Allow empty name
    ("M01", "create", "nameBytes.length == 0 ||", "false ||"),
    # M02: Allow name > 40 bytes
    ("M02", "create", "nameBytes.length > MAX_NAME_BYTES", "false"),
    # M03: Allow < 2 members
    ("M03", "create", "mLen < MIN_MEMBERS ||", "false ||"),
    # M04: Allow > 8 members
    ("M04", "create", "mLen > MAX_MEMBERS", "false"),
    # M05: Allow zero address as member
    ("M05", "create", "if (m == address(0)) revert BadMembers();", "/* if (m == address(0)) revert BadMembers(); */"),
    # M06: Allow duplicate members
    ("M06", "create", "if (m == members[j]) revert BadMembers();", "/* if (m == members[j]) revert BadMembers(); */"),
    # M07: Allow period < 1 hour
    ("M07", "create", "periodSecs < MIN_PERIOD ||", "false ||"),
    # M08: Allow period > 30 days
    ("M08", "create", "periodSecs > MAX_PERIOD", "false"),
    # M09: Allow cycles < 1
    ("M09", "create", "cycles < MIN_CYCLES ||", "false ||"),
    # M10: Allow cycles > 12
    ("M10", "create", "cycles > MAX_CYCLES", "false"),
    # M11: Allow zero bond
    ("M11", "create", "bond == 0 ||", "false ||"),
    # M12: Allow penalty > bond
    ("M12", "create", "penalty > bond", "false"),
    # M13: Allow non-member to join
    ("M13", "join", "if (!_isMember[id][msg.sender]) revert NotMember();", "/* if (!_isMember[id][msg.sender]) revert NotMember(); */"),
    # M14: Allow duplicate join
    ("M14", "join", "if (_hasJoined[id][msg.sender]) revert AlreadyJoined();", "/* if (_hasJoined[id][msg.sender]) revert AlreadyJoined(); */"),
    # M15: Allow joining with wrong bond
    ("M15", "join", "if (msg.value != r.bond) revert WrongBond(r.bond);", "/* if (msg.value != r.bond) revert WrongBond(r.bond); */"),
    # M16: Allow ack before rota started
    ("M16", "ack", "if (r.startedAt == 0) revert NotStarted();", "/* if (r.startedAt == 0) revert NotStarted(); */"),
    # M17: Allow ack after all periods over
    ("M17", "ack", "if (p >= totalPeriods) revert Over();", "/* if (p >= totalPeriods) revert Over(); */"),
    # M18: Allow non-duty member to ack
    ("M18", "ack", "if (msg.sender != onDutyMember) revert NotOnDuty(onDutyMember);", "/* if (msg.sender != onDutyMember) revert NotOnDuty(onDutyMember); */"),
    # M19: Allow duplicate ack
    ("M19", "ack", "if (_periodState[id][p] != 0) revert AlreadyAcked();", "/* if (_periodState[id][p] != 0) revert AlreadyAcked(); */"),
    # M20: Allow settle before period ends
    ("M20", "settle", "if (block.timestamp < periodEnd) revert NotEnded();", "/* if (block.timestamp < periodEnd) revert NotEnded(); */"),
    # M21: Allow duplicate settle
    ("M21", "settle", "if (_periodState[id][p] != 0) revert AlreadySettled();", "/* if (_periodState[id][p] != 0) revert AlreadySettled(); */"),
    # M22: Omit penalty transfer to next member
    ("M22", "settle", "pending[nextMember] += penaltyAmt;", "/* pending[nextMember] += penaltyAmt; */"),
    # M23: Allow exit before all periods settled
    ("M23", "exit", "if (_periodState[id][i] == 0) revert NotSettled();", "/* if (_periodState[id][i] == 0) revert NotSettled(); */"),
    # M24: Allow zero withdraw
    ("M24", "withdraw", "if (amt == 0) revert NothingToWithdraw();", "/* if (amt == 0) revert NothingToWithdraw(); */"),
    # M25: Remove nonReentrant modifier from withdraw
    ("M25", "withdraw", "function withdraw() external nonReentrant {", "function withdraw() external {"),
]

def run_mutation_test():
    with open(ORIGINAL_SOL, "r") as f:
        original_code = f.read()

    with open(BACKUP_SOL, "w") as f:
        f.write(original_code)

    total = len(mutants)
    killed = 0
    survived = []

    print(f"Running mutation testing with {total} mutants...")

    try:
        for idx, (m_id, func, target, replacement) in enumerate(mutants, 1):
            if target not in original_code:
                print(f"[{m_id}] ERROR: Target pattern not found!")
                survived.append(m_id)
                continue

            mutated_code = original_code.replace(target, replacement, 1)
            with open(ORIGINAL_SOL, "w") as f:
                f.write(mutated_code)

            # Run forge test
            res = subprocess.run(
                ["forge", "test", "--match-path", "contracts/test/Rota.t.sol"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )

            if res.returncode != 0:
                killed += 1
                print(f"[{idx:02d}/{total}] {m_id} ({func}): KILLED")
            else:
                survived.append(m_id)
                print(f"[{idx:02d}/{total}] {m_id} ({func}): SURVIVED")

    finally:
        with open(BACKUP_SOL, "r") as f:
            restored_code = f.read()
        with open(ORIGINAL_SOL, "w") as f:
            f.write(restored_code)
        if os.path.exists(BACKUP_SOL):
            os.remove(BACKUP_SOL)

    score = (killed / total) * 100
    print(f"\nMutation Score: {killed}/{total} killed ({score:.1f}%)")

    if survived:
        print(f"Surviving mutants: {', '.join(survived)}")
        sys.exit(1)
    else:
        print("All mutants killed successfully!")
        sys.exit(0)

if __name__ == "__main__":
    run_mutation_test()
