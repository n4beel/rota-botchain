import { formatEther } from "viem";
import { activeBotChain } from "@/lib/botchain/chain";

/**
 * Decodes contract errors into user-friendly diagnostic messages matching spec §4.
 */
export function decodeContractError(err: unknown): string {
  // A wallet on the other BOT Chain network: writes are pinned to this build's chain (lib/useChainWrite.ts), so wagmi
  // refuses before the wallet opens. Say what to do, not the library's name for it.
  if (/ConnectorChainMismatch|chain mismatch|does not match the target chain/i.test(err instanceof Error ? `${err.name} ${err.message}` : String(err))) {
    return `Your wallet is on a different network. Switch it to ${activeBotChain.name}, then try again.`;
  }
  if (!err) return "An unexpected error occurred.";

  const message = err instanceof Error ? err.message : String(err);

  // User rejection
  if (
    message.includes("User rejected") ||
    message.includes("User denied") ||
    message.includes("declined the request")
  ) {
    return "Transaction was cancelled in your wallet.";
  }

  // Spec-exact custom errors
  if (message.includes("NotOnDuty")) {
    const match = message.match(/NotOnDuty\(["']?(0x[0-9a-fA-F]{40})["']?\)/);
    if (match) {
      const addr = match[1];
      const shortAddr = `${addr.slice(0, 6)}...${addr.slice(-4)}`;
      return `It's ${shortAddr}'s turn.`;
    }
    return "You are not currently on duty for this period.";
  }

  if (message.includes("WrongBond")) {
    const match = message.match(/WrongBond\((\d+)\)/);
    if (match) {
      const bondWei = BigInt(match[1]);
      return `Join with exactly ${formatEther(bondWei)} BOT.`;
    }
    return "Incorrect bond amount specified.";
  }

  if (message.includes("NotEnded")) {
    return "That period hasn't ended.";
  }

  if (message.includes("NotSettled")) {
    return "All ended periods must be settled before exiting.";
  }

  if (message.includes("BadName")) {
    return "Name must be between 1 and 40 bytes.";
  }

  if (message.includes("BadMembers")) {
    return "Must provide 2 to 8 distinct, non-zero member addresses.";
  }

  if (message.includes("BadPeriod")) {
    return "Period must be between 1 hour and 30 days.";
  }

  if (message.includes("BadCycles")) {
    return "Cycles must be between 1 and 12.";
  }

  if (message.includes("BadBond")) {
    return "Bond must be positive and penalty must be between 1 wei and the bond.";
  }

  if (message.includes("NotMember")) {
    return "You are not a designated member of this rota.";
  }

  if (message.includes("AlreadyJoined")) {
    return "You have already joined this rota.";
  }

  if (message.includes("NotStarted")) {
    return "Rota has not started yet — waiting for all members to join.";
  }

  if (message.includes("AlreadyStarted")) {
    return "Rota has already started.";
  }

  if (message.includes("Over")) {
    return "All rota cycles and periods have completed.";
  }

  if (message.includes("AlreadyAcked")) {
    return "You have already acknowledged duty for this period.";
  }

  if (message.includes("AlreadySettled")) {
    return "This period has already been settled.";
  }

  if (message.includes("JoinWindowActive")) {
    return "Join window is still active. Members can exit after 7 days if unstarted.";
  }

  if (message.includes("AlreadyExited")) {
    return "You have already exited this rota.";
  }

  if (message.includes("NothingToWithdraw")) {
    return "No pending funds available to withdraw.";
  }

  if (message.includes("NotFound")) {
    return "Rota not found.";
  }

  if (message.includes("TransferFailed")) {
    return "BOT transfer failed.";
  }

  if (message.includes("REENTRANCY")) {
    return "Reentrant call prevented.";
  }

  if (message.includes("insufficient funds")) {
    return "Insufficient BOT balance for transaction and gas.";
  }

  return message.length > 120 ? `${message.slice(0, 117)}...` : message;
}

export const describeError = decodeContractError;
