/**
 * Local stack runner and seeder for Rota (Archetype AH · Roster wheel).
 *
 * Spawns anvil on port 8729 with chain id 968, deploys Rota, and seeds 4 rotas per spec §5:
 * - Rota 1: Gathering members (2 of 4 joined)
 * - Rota 2: Running with 1-hour periods (period 0 acked, 1 missed-unsettled, 2 current)
 * - Rota 3: Finished and settled (exit available)
 * - Rota 4: Unstarted past 7-day join window (exit available)
 *
 * Role table: Creator (Alice), Members A–D (Bob, Charlie, Dave, Eve).
 *
 * Usage:
 *   node scripts/local-stack.mjs
 */

import { spawn, execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  parseEther,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const PORT = 8729;
const RPC = `http://127.0.0.1:${PORT}`;
const CHAIN_ID = 968;

const KEYS = [
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", // 0: Alice (Creator)
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", // 1: Bob (Member A)
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a", // 2: Charlie (Member B)
  "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6", // 3: Dave (Member C)
  "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a", // 4: Eve (Member D)
];

const accounts = KEYS.map((k) => privateKeyToAccount(k));

const local = defineChain({
  id: CHAIN_ID,
  name: "anvil",
  nativeCurrency: { name: "Test BOT", symbol: "tBOT", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
});

try {
  execSync(`fuser -k ${PORT}/tcp 2>/dev/null || true`);
} catch {}

console.log(`Starting anvil on port ${PORT}...`);
const anvil = spawn(
  "anvil",
  [
    "--port", String(PORT),
    "--chain-id", String(CHAIN_ID),
    "--accounts", "10",
    "--balance", "10000",
    "--silent",
  ],
  { stdio: "ignore" }
);

const publicClient = createPublicClient({
  chain: local,
  transport: http(RPC),
});

const [alice, bob, charlie, dave, eve] = accounts.map((acc) =>
  createWalletClient({ account: acc, chain: local, transport: http(RPC) })
);

async function waitTx(hash) {
  return publicClient.waitForTransactionReceipt({ hash });
}

async function warp(seconds) {
  await publicClient.request({
    method: "evm_increaseTime",
    params: [seconds],
  });
  await publicClient.request({ method: "evm_mine", params: [] });
}

async function main() {
  console.log("Waiting for RPC...");
  for (let i = 0; i < 50; i++) {
    try {
      await publicClient.getBlockNumber();
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  console.log("Compiling contracts...");
  execSync("forge build", { cwd: join(process.cwd(), "contracts") });

  const artifactPath = join(
    process.cwd(),
    "contracts/out/Rota.sol/Rota.json"
  );
  const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));
  const abi = artifact.abi;
  const bytecode = artifact.bytecode.object;

  console.log("Deploying Rota...");
  const deployHash = await alice.deployContract({
    abi,
    bytecode,
    args: [],
  });
  const deployReceipt = await waitTx(deployHash);
  const contractAddress = deployReceipt.contractAddress;
  console.log(`Rota deployed to: ${contractAddress}`);

  // Write .env.local for local development
  const envContent = [
    `NEXT_PUBLIC_BOTCHAIN_CHAIN_ID=968`,
    `NEXT_PUBLIC_BOHR_RPC=http://127.0.0.1:${PORT}`,
    `NEXT_PUBLIC_RPC_URL_968=http://127.0.0.1:${PORT}`,
    `NEXT_PUBLIC_CONTRACT_968=${contractAddress}`,
    `NEXT_PUBLIC_DEPLOY_BLOCK_968=1`,
  ].join("\n");
  writeFileSync(join(process.cwd(), ".env.local"), envContent);
  console.log("Updated .env.local with deployed contract address");

  console.log("\nSeeding 4 rotas per spec §5...");

  // Seed Rota 4 first: Unstarted past 7-day join window
  console.log("Creating Rota 4 (Unstarted past 7-day join window)...");
  let tx = await alice.writeContract({
    address: contractAddress,
    abi,
    functionName: "create",
    args: [
      "Ghost Rotation",
      [alice.account.address, bob.account.address, charlie.account.address],
      3600, // 1 hour period
      2,    // 2 cycles
      parseEther("1"), // 1 BOT bond
      parseEther("0.2"), // 0.2 BOT penalty
    ],
  });
  await waitTx(tx);
  // Alice joins Rota 4 (ID 1)
  tx = await alice.writeContract({
    address: contractAddress,
    abi,
    functionName: "join",
    args: [1n],
    value: parseEther("1"),
  });
  await waitTx(tx);

  // Warp 7 days + 1 hour so Rota 4 is past JOIN_WINDOW (604,800s)
  console.log("Warping 7 days + 1 hour...");
  await warp(7 * 86400 + 3600);

  // Seed Rota 3: Finished and settled (exit available)
  console.log("Creating Rota 3 (Finished & settled, exit available)...");
  tx = await alice.writeContract({
    address: contractAddress,
    abi,
    functionName: "create",
    args: [
      "Weekend Triage",
      [alice.account.address, bob.account.address],
      3600, // 1 hour period
      1,    // 1 cycle = 2 periods total
      parseEther("2"), // 2 BOT bond
      parseEther("0.5"), // 0.5 BOT penalty
    ],
  });
  await waitTx(tx);
  // Both Alice & Bob join Rota 3 (ID 2)
  tx = await alice.writeContract({
    address: contractAddress,
    abi,
    functionName: "join",
    args: [2n],
    value: parseEther("2"),
  });
  await waitTx(tx);
  tx = await bob.writeContract({
    address: contractAddress,
    abi,
    functionName: "join",
    args: [2n],
    value: parseEther("2"),
  });
  await waitTx(tx);

  // Period 0: Alice acks
  tx = await alice.writeContract({
    address: contractAddress,
    abi,
    functionName: "ack",
    args: [2n],
  });
  await waitTx(tx);

  // Warp 1 hour to period 1
  await warp(3600);

  // Period 1: Bob acks
  tx = await bob.writeContract({
    address: contractAddress,
    abi,
    functionName: "ack",
    args: [2n],
  });
  await waitTx(tx);

  // Warp 1 hour so all periods have ended
  await warp(3600);

  // Seed Rota 2: Running with 1-hour periods (period 0 acked, 1 missed-unsettled, 2 current)
  console.log("Creating Rota 2 (Running, period 0 acked, 1 missed-unsettled, 2 current)...");
  tx = await alice.writeContract({
    address: contractAddress,
    abi,
    functionName: "create",
    args: [
      "Core Ops Duty",
      [alice.account.address, bob.account.address, charlie.account.address],
      3600, // 1 hour period
      2,    // 2 cycles = 6 periods total
      parseEther("3"), // 3 BOT bond
      parseEther("0.6"), // 0.6 BOT penalty
    ],
  });
  await waitTx(tx);
  // All three join Rota 2 (ID 3)
  tx = await alice.writeContract({
    address: contractAddress,
    abi,
    functionName: "join",
    args: [3n],
    value: parseEther("3"),
  });
  await waitTx(tx);
  tx = await bob.writeContract({
    address: contractAddress,
    abi,
    functionName: "join",
    args: [3n],
    value: parseEther("3"),
  });
  await waitTx(tx);
  tx = await charlie.writeContract({
    address: contractAddress,
    abi,
    functionName: "join",
    args: [3n],
    value: parseEther("3"),
  });
  await waitTx(tx);

  // Period 0: Alice acks
  tx = await alice.writeContract({
    address: contractAddress,
    abi,
    functionName: "ack",
    args: [3n],
  });
  await waitTx(tx);

  // Warp 1 hour to period 1
  await warp(3600);
  // Period 1: Bob is on duty, does NOT ack.

  // Warp 1 hour to period 2: Charlie is on duty (current period)
  await warp(3600);

  // Seed Rota 1: Gathering members (2 of 4 joined)
  console.log("Creating Rota 1 (Gathering members: 2 of 4 joined)...");
  tx = await alice.writeContract({
    address: contractAddress,
    abi,
    functionName: "create",
    args: [
      "Infra Reliability Rota",
      [alice.account.address, bob.account.address, charlie.account.address, dave.account.address],
      7200, // 2 hour periods
      3,    // 3 cycles
      parseEther("1.5"), // 1.5 BOT bond
      parseEther("0.3"), // 0.3 BOT penalty
    ],
  });
  await waitTx(tx);
  // Alice & Bob join Rota 1 (ID 4)
  tx = await alice.writeContract({
    address: contractAddress,
    abi,
    functionName: "join",
    args: [4n],
    value: parseEther("1.5"),
  });
  await waitTx(tx);
  tx = await bob.writeContract({
    address: contractAddress,
    abi,
    functionName: "join",
    args: [4n],
    value: parseEther("1.5"),
  });
  await waitTx(tx);

  console.log("\n=========================================");
  console.log("Rota local stack ready on port " + PORT);
  console.log("Contract:", contractAddress);
  console.log("Seeded Rotas:");
  console.log("  ID 1: Ghost Rotation (Unstarted past 7-day join window, Alice joined)");
  console.log("  ID 2: Weekend Triage (Finished & settled, exit available)");
  console.log("  ID 3: Core Ops Duty (Running: p0 acked, p1 missed-unsettled, p2 current)");
  console.log("  ID 4: Infra Reliability Rota (Gathering: 2 of 4 joined)");
  console.log("\nRole Table:");
  console.log("  Creator (Alice):  ", alice.account.address);
  console.log("  Member A (Bob):   ", bob.account.address);
  console.log("  Member B (Charlie):", charlie.account.address);
  console.log("  Member C (Dave):  ", dave.account.address);
  console.log("  Member D (Eve):   ", eve.account.address);
  console.log("=========================================\n");
}

main().catch((err) => {
  console.error("Local stack error:", err);
  if (anvil) anvil.kill();
  process.exit(1);
});

process.on("SIGINT", () => {
  if (anvil) anvil.kill();
  process.exit(0);
});
