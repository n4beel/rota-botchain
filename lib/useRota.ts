"use client";

import { useCallback, useEffect, useState } from "react";
import { usePublicClient, useAccount } from "wagmi";
import type { Address } from "viem";
import { activeBotChain } from "@/lib/botchain/chain";
import { getDeployment, ZERO_ADDRESS } from "@/lib/botchain/deployment";
import { rotaAbi } from "@/lib/botchain/abi";
import { useWriteContract, waitSuccess } from "@/lib/useChainWrite";
import { decodeContractError } from "@/lib/errors";
import type { RotaData } from "@/lib/rota";

export interface FullRota extends RotaData {
  members: Address[];
  currentP: number;
  isActive: boolean;
  bondsLeft: Record<string, bigint>;
  periodStates: Record<number, number>;
  userJoined?: boolean;
  userExited?: boolean;
}

export function useRotaDeployment() {
  return getDeployment(activeBotChain.id);
}

export function useRota(id: bigint | null) {
  const deployment = useRotaDeployment();
  const { address: userAddress } = useAccount();
  const publicClient = usePublicClient({ chainId: activeBotChain.id }); // stable-hook-result
  const [rota, setRota] = useState<FullRota | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRota = useCallback(async () => {
    if (
      !publicClient ||
      !deployment.address ||
      deployment.address === ZERO_ADDRESS ||
      !id ||
      id <= 0n
    ) {
      setRota(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const [rotaRaw, membersRaw, currentPeriodRaw] = await Promise.all([
        publicClient.readContract({
          address: deployment.address,
          abi: rotaAbi,
          functionName: "rotaOf",
          args: [id],
        }),
        publicClient.readContract({
          address: deployment.address,
          abi: rotaAbi,
          functionName: "membersOf",
          args: [id],
        }),
        publicClient.readContract({
          address: deployment.address,
          abi: rotaAbi,
          functionName: "currentPeriod",
          args: [id],
        }),
      ]);

      const members = membersRaw as Address[];
      const [isActive, currentP] = currentPeriodRaw;

      // Fetch bondLeftOf for all members
      const bondsPromises = members.map((m) =>
        publicClient.readContract({
          address: deployment.address,
          abi: rotaAbi,
          functionName: "bondLeftOf",
          args: [id, m],
        })
      );

      // Total periods: members.length * cycles
      const totalPeriods = members.length * rotaRaw.cycles;
      // Fetch period states up to current period (or all if rota completed)
      const maxPToFetch = Math.min(Number(currentP) + 1, totalPeriods);
      const periodStatePromises: Promise<number>[] = [];
      const periodIndices: number[] = [];
      for (let p = 0; p < maxPToFetch; p++) {
        periodIndices.push(p);
        periodStatePromises.push(
          publicClient.readContract({
            address: deployment.address,
            abi: rotaAbi,
            functionName: "periodState",
            args: [id, p],
          }) as Promise<number>
        );
      }

      // Check user membership status if connected
      let userJoined = false;
      let userExited = false;
      if (userAddress) {
        const [joined, exited] = await Promise.all([
          publicClient.readContract({
            address: deployment.address,
            abi: rotaAbi,
            functionName: "hasJoined",
            args: [id, userAddress],
          }),
          publicClient.readContract({
            address: deployment.address,
            abi: rotaAbi,
            functionName: "hasExited",
            args: [id, userAddress],
          }),
        ]);
        userJoined = Boolean(joined);
        userExited = Boolean(exited);
      }

      const [bondsRes, statesRes] = await Promise.all([
        Promise.all(bondsPromises),
        Promise.all(periodStatePromises),
      ]);

      const bondsLeft: Record<string, bigint> = {};
      members.forEach((m, idx) => {
        bondsLeft[m.toLowerCase()] = bondsRes[idx] as bigint;
      });

      const periodStates: Record<number, number> = {};
      periodIndices.forEach((p, idx) => {
        periodStates[p] = Number(statesRes[idx]);
      });

      setRota({
        id,
        createdAt: rotaRaw.createdAt,
        startedAt: rotaRaw.startedAt,
        periodSecs: rotaRaw.periodSecs,
        memberCount: rotaRaw.memberCount,
        cycles: rotaRaw.cycles,
        joined: rotaRaw.joined,
        bond: rotaRaw.bond,
        penalty: rotaRaw.penalty,
        name: rotaRaw.name,
        members,
        currentP: Number(currentP),
        isActive,
        bondsLeft,
        periodStates,
        userJoined,
        userExited,
      });
    } catch (err) {
      setError(decodeContractError(err));
      setRota(null);
    } finally {
      setLoading(false);
    }
  }, [publicClient, deployment.address, id, userAddress]);

  useEffect(() => {
    fetchRota();
  }, [fetchRota]); // stable-hook-result

  return { rota, loading, error, refresh: fetchRota };
}

export function useRotasList(userAddress?: Address) {
  const deployment = useRotaDeployment();
  const publicClient = usePublicClient({ chainId: activeBotChain.id }); // stable-hook-result
  const [rotas, setRotas] = useState<FullRota[]>([]);
  const [userRotas, setUserRotas] = useState<FullRota[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (
      !publicClient ||
      !deployment.address ||
      deployment.address === ZERO_ADDRESS
    ) {
      setRotas([]);
      setUserRotas([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const count = (await publicClient.readContract({
        address: deployment.address,
        abi: rotaAbi,
        functionName: "rotaCount",
      })) as bigint;

      const total = Number(count);
      const latestIds: bigint[] = [];
      for (let i = total; i >= 1 && latestIds.length < 50; i--) {
        latestIds.push(BigInt(i));
      }

      let userIds: bigint[] = [];
      if (userAddress) {
        userIds = (await publicClient.readContract({
          address: deployment.address,
          abi: rotaAbi,
          functionName: "byMember",
          args: [userAddress],
        })) as bigint[];
      }

      // Collect unique IDs to fetch
      const uniqueIds = Array.from(new Set([...latestIds, ...userIds]));

      const fetchedList: FullRota[] = [];
      for (const id of uniqueIds) {
        try {
          const [rotaRaw, membersRaw, currentPeriodRaw] = await Promise.all([
            publicClient.readContract({
              address: deployment.address,
              abi: rotaAbi,
              functionName: "rotaOf",
              args: [id],
            }),
            publicClient.readContract({
              address: deployment.address,
              abi: rotaAbi,
              functionName: "membersOf",
              args: [id],
            }),
            publicClient.readContract({
              address: deployment.address,
              abi: rotaAbi,
              functionName: "currentPeriod",
              args: [id],
            }),
          ]);

          const members = membersRaw as Address[];
          const [isActive, currentP] = currentPeriodRaw;

          let userJoined = false;
          let userExited = false;
          if (userAddress) {
            const [joined, exited] = await Promise.all([
              publicClient.readContract({
                address: deployment.address,
                abi: rotaAbi,
                functionName: "hasJoined",
                args: [id, userAddress],
              }),
              publicClient.readContract({
                address: deployment.address,
                abi: rotaAbi,
                functionName: "hasExited",
                args: [id, userAddress],
              }),
            ]);
            userJoined = Boolean(joined);
            userExited = Boolean(exited);
          }

          fetchedList.push({
            id,
            createdAt: rotaRaw.createdAt,
            startedAt: rotaRaw.startedAt,
            periodSecs: rotaRaw.periodSecs,
            memberCount: rotaRaw.memberCount,
            cycles: rotaRaw.cycles,
            joined: rotaRaw.joined,
            bond: rotaRaw.bond,
            penalty: rotaRaw.penalty,
            name: rotaRaw.name,
            members,
            currentP: Number(currentP),
            isActive,
            bondsLeft: {},
            periodStates: {},
            userJoined,
            userExited,
          });
        } catch {
          // ignore individual fetch errors
        }
      }

      const latestRotas = latestIds
        .map((id) => fetchedList.find((r) => r.id === id))
        .filter((r): r is FullRota => r !== undefined);

      const userRotasList = userIds
        .map((id) => fetchedList.find((r) => r.id === id))
        .filter((r): r is FullRota => r !== undefined);

      setRotas(latestRotas);
      setUserRotas(userRotasList);
    } catch (err) {
      setError(decodeContractError(err));
      setRotas([]);
      setUserRotas([]);
    } finally {
      setLoading(false);
    }
  }, [publicClient, deployment.address, userAddress]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]); // stable-hook-result

  return { rotas, userRotas, loading, error, refresh: fetchAll };
}

export function useUserPending(userAddress?: Address) {
  const deployment = useRotaDeployment();
  const publicClient = usePublicClient({ chainId: activeBotChain.id }); // stable-hook-result
  const [pending, setPending] = useState<bigint | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPending = useCallback(async () => {
    if (
      !publicClient ||
      !deployment.address ||
      deployment.address === ZERO_ADDRESS ||
      !userAddress
    ) {
      setPending(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const res = (await publicClient.readContract({
        address: deployment.address,
        abi: rotaAbi,
        functionName: "pending",
        args: [userAddress],
      })) as bigint;
      setPending(res);
    } catch {
      setPending(null);
    } finally {
      setLoading(false);
    }
  }, [publicClient, deployment.address, userAddress]);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]); // stable-hook-result

  return { pending, loading, refresh: fetchPending };
}

export function useRotaActions() {
  const deployment = useRotaDeployment();
  const publicClient = usePublicClient({ chainId: activeBotChain.id }); // stable-hook-result
  const { writeContractAsync } = useWriteContract();
  const [isPending, setIsPending] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);

  const createRota = useCallback(
    async (
      name: string,
      members: Address[],
      periodSecs: number,
      cycles: number,
      bond: bigint,
      penalty: bigint
    ) => {
      if (!publicClient || !deployment.address) {
        throw new Error("Contract not ready");
      }
      setIsPending(true);
      setTxError(null);
      try {
        const hash = await writeContractAsync({
          address: deployment.address,
          abi: rotaAbi,
          functionName: "create",
          args: [name, members, periodSecs, cycles, bond, penalty],
        });
        const receipt = await waitSuccess(publicClient, hash);
        return receipt;
      } catch (err) {
        const msg = decodeContractError(err);
        setTxError(msg);
        throw err;
      } finally {
        setIsPending(false);
      }
    },
    [publicClient, deployment.address, writeContractAsync]
  );

  const joinRota = useCallback(
    async (id: bigint, bondWei: bigint) => {
      if (!publicClient || !deployment.address) {
        throw new Error("Contract not ready");
      }
      setIsPending(true);
      setTxError(null);
      try {
        const hash = await writeContractAsync({
          address: deployment.address,
          abi: rotaAbi,
          functionName: "join",
          args: [id],
          value: bondWei,
        });
        const receipt = await waitSuccess(publicClient, hash);
        return receipt;
      } catch (err) {
        const msg = decodeContractError(err);
        setTxError(msg);
        throw err;
      } finally {
        setIsPending(false);
      }
    },
    [publicClient, deployment.address, writeContractAsync]
  );

  const ackDuty = useCallback(
    async (id: bigint) => {
      if (!publicClient || !deployment.address) {
        throw new Error("Contract not ready");
      }
      setIsPending(true);
      setTxError(null);
      try {
        const hash = await writeContractAsync({
          address: deployment.address,
          abi: rotaAbi,
          functionName: "ack",
          args: [id],
        });
        const receipt = await waitSuccess(publicClient, hash);
        return receipt;
      } catch (err) {
        const msg = decodeContractError(err);
        setTxError(msg);
        throw err;
      } finally {
        setIsPending(false);
      }
    },
    [publicClient, deployment.address, writeContractAsync]
  );

  const settlePeriod = useCallback(
    async (id: bigint, p: number) => {
      if (!publicClient || !deployment.address) {
        throw new Error("Contract not ready");
      }
      setIsPending(true);
      setTxError(null);
      try {
        const hash = await writeContractAsync({
          address: deployment.address,
          abi: rotaAbi,
          functionName: "settle",
          args: [id, p],
        });
        const receipt = await waitSuccess(publicClient, hash);
        return receipt;
      } catch (err) {
        const msg = decodeContractError(err);
        setTxError(msg);
        throw err;
      } finally {
        setIsPending(false);
      }
    },
    [publicClient, deployment.address, writeContractAsync]
  );

  const exitRota = useCallback(
    async (id: bigint) => {
      if (!publicClient || !deployment.address) {
        throw new Error("Contract not ready");
      }
      setIsPending(true);
      setTxError(null);
      try {
        const hash = await writeContractAsync({
          address: deployment.address,
          abi: rotaAbi,
          functionName: "exit",
          args: [id],
        });
        const receipt = await waitSuccess(publicClient, hash);
        return receipt;
      } catch (err) {
        const msg = decodeContractError(err);
        setTxError(msg);
        throw err;
      } finally {
        setIsPending(false);
      }
    },
    [publicClient, deployment.address, writeContractAsync]
  );

  const withdrawPending = useCallback(async () => {
    if (!publicClient || !deployment.address) {
      throw new Error("Contract not ready");
    }
    setIsPending(true);
    setTxError(null);
    try {
      const hash = await writeContractAsync({
        address: deployment.address,
        abi: rotaAbi,
        functionName: "withdraw",
      });
      const receipt = await waitSuccess(publicClient, hash);
      return receipt;
    } catch (err) {
      const msg = decodeContractError(err);
      setTxError(msg);
      throw err;
    } finally {
      setIsPending(false);
    }
  }, [publicClient, deployment.address, writeContractAsync]);

  return {
    createRota,
    joinRota,
    ackDuty,
    settlePeriod,
    exitRota,
    withdrawPending,
    isPending,
    txError,
    clearTxError: () => setTxError(null),
  };
}
