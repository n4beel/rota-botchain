import { spawn, execSync, type ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  parseEther,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { rotaAbi } from "@/lib/botchain/abi";

const PORT = 8629;
const RPC = `http://127.0.0.1:${PORT}`;
const CHAIN_ID = 968;

const localChain = defineChain({
  id: CHAIN_ID,
  name: "anvil",
  nativeCurrency: { name: "Test BOT", symbol: "tBOT", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
});

const ACCOUNTS = [
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", // Alice (Member 1)
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", // Bob (Member 2)
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a", // Charlie (Member 3)
  "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6", // Dave (Member 4 / Outsider)
].map((k) => privateKeyToAccount(k as `0x${string}`));

describe("Rota On-Chain Integration Tests", { timeout: 60000 }, () => {
  let anvil: ChildProcess;
  let contractAddress: Address;

  const publicClient = createPublicClient({
    chain: localChain,
    transport: http(RPC),
    pollingInterval: 100,
  });

  const wallets = ACCOUNTS.map((account) =>
    createWalletClient({ account, chain: localChain, transport: http(RPC) }),
  );
  const [alice, bob, charlie, dave] = wallets;

  async function mine() {
    await publicClient.request({ method: "evm_mine" as any, params: [] as any });
  }

  async function warp(seconds: number) {
    await publicClient.request({
      method: "evm_increaseTime" as any,
      params: [seconds] as any,
    });
    await mine();
  }

  async function waitTx(hash: `0x${string}`) {
    return publicClient.waitForTransactionReceipt({ hash, timeout: 15000 });
  }

  beforeAll(async () => {
    try {
      execSync(`fuser -k ${PORT}/tcp 2>/dev/null || true`);
    } catch {}

    // 1. Start anvil on port 8629
    anvil = spawn("anvil", [
      "--port", String(PORT),
      "--chain-id", String(CHAIN_ID),
      "--accounts", "10",
      "--balance", "10000",
      "--silent",
    ], { stdio: "ignore" });

    // Wait for anvil ready
    for (let i = 0; i < 80; i++) {
      try {
        await publicClient.getBlockNumber();
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 100));
      }
    }

    // 2. Deploy Rota.sol
    const artPath = join(process.cwd(), "contracts", "out", "Rota.sol", "Rota.json");
    const art = JSON.parse(readFileSync(artPath, "utf8"));
    const deployHash = await alice.deployContract({
      abi: rotaAbi,
      bytecode: art.bytecode.object as `0x${string}`,
      args: [],
    });
    const receipt = await waitTx(deployHash);
    if (!receipt.contractAddress) throw new Error("Deploy failed: no contractAddress");
    contractAddress = receipt.contractAddress;
  });

  afterAll(() => {
    if (anvil) anvil.kill();
    try { execSync(`fuser -k ${PORT}/tcp 2>/dev/null || true`); } catch {}
  });

  it("completes full lifecycle: create, join, rotation, missed duty penalty transfer, exit, and withdraw", async () => {
    // 1. Alice creates rota with Alice, Bob, Charlie (3 members, 3600s period, 1 cycle, 1 BOT bond, 0.2 BOT penalty)
    const members = [alice.account.address, bob.account.address, charlie.account.address];
    const createTx = await alice.writeContract({
      address: contractAddress,
      abi: rotaAbi,
      functionName: "create",
      args: ["Ops Duty", members, 3600, 1, parseEther("1"), parseEther("0.2")],
    });
    await waitTx(createTx);

    const rCount = await publicClient.readContract({
      address: contractAddress,
      abi: rotaAbi,
      functionName: "rotaCount",
    });
    expect(rCount).toBe(1n);

    // 2. Members join
    await waitTx(
      await alice.writeContract({
        address: contractAddress,
        abi: rotaAbi,
        functionName: "join",
        args: [1n],
        value: parseEther("1"),
      })
    );
    await waitTx(
      await bob.writeContract({
        address: contractAddress,
        abi: rotaAbi,
        functionName: "join",
        args: [1n],
        value: parseEther("1"),
      })
    );
    await waitTx(
      await charlie.writeContract({
        address: contractAddress,
        abi: rotaAbi,
        functionName: "join",
        args: [1n],
        value: parseEther("1"),
      })
    );

    const rInfo = await publicClient.readContract({
      address: contractAddress,
      abi: rotaAbi,
      functionName: "rotaOf",
      args: [1n],
    });
    expect(rInfo.joined).toBe(3);
    expect(rInfo.startedAt).toBeGreaterThan(0n);

    // 3. Period 0: Alice is on duty. Alice acks!
    const cp0 = await publicClient.readContract({
      address: contractAddress,
      abi: rotaAbi,
      functionName: "currentPeriod",
      args: [1n],
    });
    expect(cp0[1]).toBe(0);
    expect(cp0[2].toLowerCase()).toBe(alice.account.address.toLowerCase());

    const ackTx = await alice.writeContract({
      address: contractAddress,
      abi: rotaAbi,
      functionName: "ack",
      args: [1n],
    });
    await waitTx(ackTx);

    const state0 = await publicClient.readContract({
      address: contractAddress,
      abi: rotaAbi,
      functionName: "periodState",
      args: [1n, 0],
    });
    expect(state0).toBe(1); // 1 = acked

    // 4. Warp to Period 1: Bob is on duty. Bob MISSED!
    await warp(3601);

    const cp1 = await publicClient.readContract({
      address: contractAddress,
      abi: rotaAbi,
      functionName: "currentPeriod",
      args: [1n],
    });
    expect(cp1[1]).toBe(1);
    expect(cp1[2].toLowerCase()).toBe(bob.account.address.toLowerCase());

    // Warp past Period 1 to Period 2
    await warp(3601);

    // 5. Anyone settles Period 1
    const settleTx = await dave.writeContract({
      address: contractAddress,
      abi: rotaAbi,
      functionName: "settle",
      args: [1n, 1],
    });
    await waitTx(settleTx);

    const state1 = await publicClient.readContract({
      address: contractAddress,
      abi: rotaAbi,
      functionName: "periodState",
      args: [1n, 1],
    });
    expect(state1).toBe(2); // 2 = missed & settled

    // Bob's bond reduced by 0.2 BOT; Charlie (next in line) credited with 0.2 BOT!
    const bobBond = await publicClient.readContract({
      address: contractAddress,
      abi: rotaAbi,
      functionName: "bondLeftOf",
      args: [1n, bob.account.address],
    });
    expect(bobBond).toBe(parseEther("0.8"));

    const charliePending = await publicClient.readContract({
      address: contractAddress,
      abi: rotaAbi,
      functionName: "pending",
      args: [charlie.account.address],
    });
    expect(charliePending).toBe(parseEther("0.2"));

    // 6. Period 2: Charlie acks
    const ack2Tx = await charlie.writeContract({
      address: contractAddress,
      abi: rotaAbi,
      functionName: "ack",
      args: [1n],
    });
    await waitTx(ack2Tx);

    // 7. Warp past all periods (total periods = 3 * 1 = 3)
    await warp(3601);

    // 8. Exit: Alice, Bob, Charlie reclaim bonds
    await waitTx(
      await alice.writeContract({
        address: contractAddress,
        abi: rotaAbi,
        functionName: "exit",
        args: [1n],
      })
    );
    await waitTx(
      await bob.writeContract({
        address: contractAddress,
        abi: rotaAbi,
        functionName: "exit",
        args: [1n],
      })
    );
    await waitTx(
      await charlie.writeContract({
        address: contractAddress,
        abi: rotaAbi,
        functionName: "exit",
        args: [1n],
      })
    );

    // Check pendings
    const alicePending = await publicClient.readContract({
      address: contractAddress,
      abi: rotaAbi,
      functionName: "pending",
      args: [alice.account.address],
    });
    expect(alicePending).toBe(parseEther("1")); // Full 1 BOT

    const bobFinalPending = await publicClient.readContract({
      address: contractAddress,
      abi: rotaAbi,
      functionName: "pending",
      args: [bob.account.address],
    });
    expect(bobFinalPending).toBe(parseEther("0.8")); // 1 - 0.2 = 0.8 BOT

    const charlieFinalPending = await publicClient.readContract({
      address: contractAddress,
      abi: rotaAbi,
      functionName: "pending",
      args: [charlie.account.address],
    });
    expect(charlieFinalPending).toBe(parseEther("1.2")); // 1 + 0.2 = 1.2 BOT

    // 9. Withdraw: Charlie withdraws 1.2 BOT
    const balBefore = await publicClient.getBalance({ address: charlie.account.address });
    const wdTx = await charlie.writeContract({
      address: contractAddress,
      abi: rotaAbi,
      functionName: "withdraw",
    });
    const wdRcpt = await waitTx(wdTx);
    const gasUsed = wdRcpt.gasUsed * wdRcpt.effectiveGasPrice;
    const balAfter = await publicClient.getBalance({ address: charlie.account.address });
    expect(balAfter + gasUsed - balBefore).toBe(parseEther("1.2"));
  });

  it("allows unstarted rota exit after 7-day join window", async () => {
    const members = [alice.account.address, bob.account.address];
    const createTx = await alice.writeContract({
      address: contractAddress,
      abi: rotaAbi,
      functionName: "create",
      args: ["Stalled Rota", members, 3600, 1, parseEther("2"), parseEther("1")],
    });
    await waitTx(createTx);

    // Alice joins
    await waitTx(
      await alice.writeContract({
        address: contractAddress,
        abi: rotaAbi,
        functionName: "join",
        args: [2n],
        value: parseEther("2"),
      })
    );

    // Bob never joins. Warp past 7 days (7 * 86400 = 604800s)
    await warp(604801);

    // Alice exits full 2 BOT bond
    await waitTx(
      await alice.writeContract({
        address: contractAddress,
        abi: rotaAbi,
        functionName: "exit",
        args: [2n],
      })
    );

    const pendingAlice = await publicClient.readContract({
      address: contractAddress,
      abi: rotaAbi,
      functionName: "pending",
      args: [alice.account.address],
    });
    // 1 BOT from first test + 2 BOT from this test = 3 BOT
    expect(pendingAlice).toBe(parseEther("3"));
  });

  it("enforces contract reverts properly", async () => {
    // Non-member joins
    await expect(
      dave.writeContract({
        address: contractAddress,
        abi: rotaAbi,
        functionName: "join",
        args: [2n],
        value: parseEther("2"),
      })
    ).rejects.toThrow();

    // Wrong bond value
    await expect(
      bob.writeContract({
        address: contractAddress,
        abi: rotaAbi,
        functionName: "join",
        args: [2n],
        value: parseEther("1"),
      })
    ).rejects.toThrow();
  });
});
