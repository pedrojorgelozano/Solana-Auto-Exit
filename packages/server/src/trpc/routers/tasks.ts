import { z } from "zod";
import { router, publicProcedure, TRPCError } from "../init.js";

const createTaskInput = z
  .object({
    protocol: z.string().min(1),
    network: z.enum(["mainnet", "devnet"]),
    rpcUrl: z.string().url(),
    positionId: z.string().min(1),
    protocolConfig: z.record(z.string(), z.unknown()),

    takeProfitPrice: z.number().positive().nullable().optional(),
    stopLossPrice: z.number().positive().nullable().optional(),
    slippageBps: z.number().int().min(0).max(10_000),
    pollMs: z.number().int().min(1_000),
    dryRun: z.boolean(),

    exitTokenMint: z.string().min(32).optional(),
    exitSwapSlippageBps: z.number().int().min(0).max(10_000),
  })
  .refine(
    (v) =>
      (v.takeProfitPrice != null && v.takeProfitPrice > 0) ||
      (v.stopLossPrice != null && v.stopLossPrice > 0),
    { message: "At least one of takeProfitPrice or stopLossPrice is required." },
  )
  .refine(
    (v) =>
      v.takeProfitPrice == null ||
      v.stopLossPrice == null ||
      v.takeProfitPrice > v.stopLossPrice,
    {
      message:
        "Take-profit price must be greater than stop-loss price (TP > SL).",
    },
  );

const idInput = z.object({ id: z.string().uuid() });

export const tasksRouter = router({
  /** Crea una task en estado "idle". No la arranca automáticamente. */
  create: publicProcedure
    .input(createTaskInput)
    .mutation(({ ctx, input }) => {
      if (input.network === "mainnet" && process.env.ALLOW_MAINNET_LIVE !== "true") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Mainnet is not enabled on this server. Set ALLOW_MAINNET_LIVE=true and restart, then switch the network in /settings.",
        });
      }
      return ctx.taskManager.createTask(input);
    }),

  /**
   * Lista todas las tasks (ordenadas por createdAt desc). Si la task está
   * corriendo, se enriquece con el último precio leído (snapshot en memoria).
   */
  list: publicProcedure.query(({ ctx }) => {
    const rows = ctx.taskManager.listTasks();
    return rows.map((row) => ({
      ...row,
      runtime: ctx.taskManager.getRunningSnapshot(row.id),
    }));
  }),

  get: publicProcedure.input(idInput).query(({ ctx, input }) => {
    const row = ctx.taskManager.getTask(input.id);
    if (!row) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Task not found." });
    }
    return {
      ...row,
      runtime: ctx.taskManager.getRunningSnapshot(input.id),
    };
  }),

  /**
   * Eventos de history para una task, más recientes primero. Activity feed
   * del timeline en `/tasks/[id]`.
   */
  history: publicProcedure.input(idInput).query(({ ctx, input }) => {
    const row = ctx.taskManager.getTask(input.id);
    if (!row) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Task not found." });
    }
    return ctx.taskManager.listHistory(input.id);
  }),

  /** Arma el watcher. Requiere vault unlocked. */
  start: publicProcedure.input(idInput).mutation(({ ctx, input }) => {
    try {
      ctx.taskManager.startTask(input.id);
      return { ok: true };
    } catch (err) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }),

  pause: publicProcedure.input(idInput).mutation(({ ctx, input }) => {
    ctx.taskManager.pauseTask(input.id);
    return { ok: true };
  }),

  stop: publicProcedure.input(idInput).mutation(({ ctx, input }) => {
    try {
      ctx.taskManager.stopTask(input.id);
      return { ok: true };
    } catch (err) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }),

  delete: publicProcedure.input(idInput).mutation(({ ctx, input }) => {
    ctx.taskManager.deleteTask(input.id);
    return { ok: true };
  }),
});
