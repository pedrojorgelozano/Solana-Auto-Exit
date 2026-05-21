/**
 * English dictionary. "auto-exit" se mantiene sin traducir en ambos
 * idiomas (es el nombre del producto / concepto técnico).
 *
 * Esta es la fuente de verdad de tipos — `es.ts` debe matchear esta
 * estructura exactamente (lo enforza el tipo `typeof en` allí).
 */
export const en = {
  // ============================================================================
  // Common — usados en muchos sitios
  // ============================================================================
  common: {
    save: "Save",
    saving: "Saving…",
    saveChanges: "Save changes",
    cancel: "Cancel",
    delete: "Delete",
    deleting: "Deleting…",
    confirm: "Confirm",
    loading: "Loading…",
    yes: "Yes",
    back: "Back",
    home: "Home",
    saved: "Saved.",
    unsaved: "Unsaved changes.",
    allSaved: "All saved.",
    open: "open →",
    details: "details →",
    autoExit: "auto-exit →",
    viewAll: "View all →",
    readMore: "→ Read more",
    docs: "docs",
    noData: "no data",
    refresh: "Refresh",
  },

  // ============================================================================
  // Header global
  // ============================================================================
  header: {
    docs: "Docs",
    settings: "Settings",
    botRunning: "bot running",
    botUnreachable: "bot unreachable",
    connecting: "connecting",
    testMode: "test mode",
    testModeTooltip: "Test mode (Solana devnet) — click to switch back to real",
    onOrcaMeteora: "on Orca · Meteora",
    languageToggle: "Language",
  },

  // ============================================================================
  // VaultChip
  // ============================================================================
  vaultChip: {
    wallet: "wallet",
    setupWallet: "set up wallet",
    walletLocked: "wallet locked",
    walletUnlocked: "wallet unlocked",
  },

  // ============================================================================
  // Status labels (statusView)
  // ============================================================================
  status: {
    idle: {
      label: "Ready",
      description: "Configured but not watching yet.",
    },
    armed: {
      label: "Watching",
      description: "Polling the pool for the trigger condition.",
    },
    triggered: {
      label: "Target hit",
      description: "Trigger condition met. Preparing the close.",
    },
    closing: {
      label: "Closing position",
      description:
        "Sending the close (and swap, if configured). This takes a few seconds.",
    },
    done: {
      label: "Completed",
      description: "Closed cleanly. See the result below.",
    },
    error: {
      label: "Stopped — error",
      description: "Something went wrong. See details below.",
    },
    paused: {
      label: "Paused",
      description: "Not watching. Resume to continue.",
    },
    stopped: {
      label: "Stopped",
      description: "Stopped by the user.",
    },
    noExit: "No exit",
  },

  // ============================================================================
  // Format helpers (range, time ago, buffer)
  // ============================================================================
  format: {
    inRange: "In your range",
    outOfRange: "Out of range",
    bufferOff: "off",
    bufferMet: "buffer met",
    lessThan1mLeft: "less than 1m left",
    minutesLeft: (m: number) => `${m}m left`,
    hoursLeft: (h: number, m: number) =>
      m > 0 ? `${h}h ${m}m left` : `${h}h left`,
    daysLeft: (d: number, h: number) =>
      h > 0 ? `${d}d ${h}h left` : `${d}d left`,
    justNow: "just now",
    secondsAgo: (s: number) => `${s}s ago`,
    minutesAgo: (m: number) => `${m}m ago`,
    hoursAgo: (h: number) => `${h}h ago`,
    awayFromCurrent: "from current",
    triggerAlreadyTrue: " · trigger already true",
    triggerMet: " · trigger met",
    firedThisOne: "· fired this one",
    sim: "· sim",
    simulation: "· simulation",
  },

  // ============================================================================
  // Home — first run (sin wallet) + connected (con hub de posiciones)
  // ============================================================================
  home: {
    firstRun: {
      eyebrow: "auto exits for liquidity pools on Solana",
      titleLine1: "Set the conditions.",
      titleLine2: "Walk away.",
      intro:
        "Auto-Exit watches your Orca (and soon Meteora) liquidity positions every few seconds and closes them when price hits your take-profit or stop-loss. It runs on this machine and signs with a wallet you control.",
      stepsEyebrow: "How it works",
      stepsTitle: "Three steps, then nothing.",
      step1Title: "Bot wallet",
      step1Body:
        "A dedicated Solana account whose key lives encrypted on this machine. The bot uses it to sign the close transaction when triggers fire — including while you're asleep. That's the part Phantom-style popups can't do.",
      step2Title: "Funded positions",
      step2Body:
        "Fund the bot wallet with SOL (for fees) and the tokens you want it to manage. Open new LP positions from it on Orca, or transfer the NFT of an existing position to it.",
      step3Title: "Triggers",
      step3Body:
        "For each position, set a take-profit price, a stop-loss price, or both. The bot closes when whichever hits first; optionally swaps the proceeds into a stable.",
      ctaCreateWallet: "Create the bot's wallet →",
      ctaReadGuide: "Read the full guide →",
      stepHint: "Step 1 of 3 · stop and resume at any point.",
      localEyebrow: "Local stack",
      localBody:
        "The server listens on localhost only. Your wallet key is encrypted at rest with your passphrase and decrypted in memory only while unlocked — nothing about your wallet, positions, or trades leaves this machine.",
    },

    eyebrow: {
      botWallet: "Bot wallet",
      locked: "· locked",
      onePosition: "1 position",
      manyPositions: (n: number) => `${n} positions`,
      loadingPositions: "loading positions…",
      oneWatching: "1 auto-exit watching",
      manyWatching: (n: number) => `${n} auto-exits watching`,
      whatIs: "→ What's a bot wallet",
    },

    hub: {
      headerStatus: "Status",
      headerPosition: "Position",
      headerAutoExit: "Auto-exit",
      headerAction: "Action",
      loading: "Querying chain for positions of this wallet…",
      oneProtocolFailed: (msg: string) => `One protocol query failed: ${msg}`,
    },

    emptyHub: {
      eyebrow: "Empty",
      title: "No LP positions in this wallet yet.",
      intro:
        "The bot can only close positions whose NFT this address holds. There are two ways to put one here.",
      addressLabel: "Bot wallet address",
      copy: "copy",
      copied: "copied",
      path1Title: "Open new positions from the bot account",
      path1Body:
        "Import the bot's secret into Phantom or Backpack as a new account (Settings → Add wallet → Import private key). Switch to it, then open an LP on Orca or Meteora normally. The position NFT will be owned by this same address and will appear here on refresh.",
      path2Title: "Transfer an existing position NFT",
      path2Body:
        "From any account that currently owns a Whirlpool or DLMM position, send the position NFT to the address above. Ownership moves to the bot wallet and the position becomes closable from here. Don't forget to leave the bot wallet enough SOL for close + swap fees.",
      openOrca: "open orca ↗",
      openMeteora: "open meteora ↗",
      stepByStep: "→ Step-by-step guide",
    },

    activity: {
      eyebrow: "Transaction history",
      title: "Closes, swaps and failures.",
      viewAll: "View all →",
      headerWhen: "When",
      headerPosition: "Position",
      headerTrigger: "Trigger",
      headerResult: "Result",
      headerTxError: "Tx / Error",
      resultClosed: "Closed",
      resultFailed: "Failed",
      resultStopped: "Stopped",
      slippageTag: "· slippage",
      simulated: "simulated",
    },
  },

  // ============================================================================
  // /positions/[mint] — configure form
  // ============================================================================
  configure: {
    pageEyebrow: "Position",
    pageTitle: "Configure the exit.",
    backLabel: "Home",
    positionNotInWallet: (mint: string) =>
      `Position ${mint} is not in this wallet.`,

    needWallet: {
      lockedEyebrow: "Wallet is locked",
      noVaultEyebrow: "No wallet",
      lockedTitle: "Unlock to configure.",
      noVaultTitle: "Set up your wallet first.",
      unlockCta: "Unlock wallet →",
      setupCta: "Go to wallet →",
    },

    existing: {
      title: "This position already has an auto-exit.",
      intro:
        "One auto-exit per position. Open it to see its live status, pause or stop it. If you want different settings, delete the current one and set up a new one.",
      fieldTakeProfit: "Take profit",
      fieldStopLoss: "Stop loss",
      fieldLastPrice: "Last price",
      fieldNearest: "Nearest",
      deleteConfirm: "Delete the current auto-exit?",
      cancel: "Cancel",
      yesDelete: "Yes, delete",
      deleteCta: "Delete auto-exit",
      openCta: "Open auto-exit →",
    },

    recap: {
      pairWithProtocol: (protocol: string, a: string, b: string) =>
        `${protocol} · ${a} / ${b}`,
      labelRange: "Range",
      labelHoldings: (sym: string) => `Holdings ${sym}`,
      labelFeesPending: "Fees pending",
      loading: "Loading position state…",
      currentPrice1To1: (a: string, price: string, b: string) =>
        `1 ${a} = ${price} ${b}`,
    },

    form: {
      section1: "1 — When to close",
      section1Intro:
        "Enable take-profit, stop-loss, or both. The auto-exit closes when either price is hit (whichever happens first).",
      howTriggersWork: "→ How triggers work",
      takeProfit: "Take profit",
      stopLoss: "Stop loss",
      tpDescription: (a: string, b: string) =>
        `close when 1 ${a} rises to a target price in ${b}`,
      slDescription: (a: string, b: string) =>
        `close when 1 ${a} drops to a target price in ${b}`,
      fromCurrent: "from current",
      targetPriceLabel: (a: string, b: string) =>
        `Target price (${b} per ${a})`,
      currentHint: (price: string) => `current ${price}`,
      timeBuffer: "Time buffer",
      bufferOnCopy: (direction: "above" | "below") =>
        `Close only if the price stays ${direction} the target for at least this long. If it leaves the zone, the timer resets.`,
      bufferOffCopy: "Fire as soon as the price crosses the target — no waiting.",
      readMoreBuffer: "→ Read more",

      section2: "2 — What to do with the output",
      section2Docs: "→ docs",
      exitKeepBoth: "Keep both tokens",
      exitSell: (sym: string) => `Sell into ${sym}`,
      exitNoneCopy:
        "Both tokens are returned to your wallet as the position releases them.",
      exitWithCopy: (sym: string, slippagePct: string) =>
        `After closing, the non-${sym} side is swapped on the same pool with up to ${slippagePct}% slippage tolerance.`,

      section3: "3 — Safety",
      closeSlippageLabel: "Close slippage tolerance",
      closeSlippageCopy:
        "How much the pool price is allowed to drift between submission and execution before the close transaction reverts. Higher values complete more reliably in volatile markets; lower values give a stricter price guarantee but can fail and retry more often.",
      readMoreSlippage: "→ Read more",

      advancedShow: "+ Show advanced settings",
      advancedHide: "− Hide advanced settings",
      exitSwapSlippageLabel: "Exit swap slippage",

      errorAtLeastOne:
        "Enable take-profit, stop-loss, or both. At least one is required.",
      errorTpGtSl:
        "Take-profit must be greater than stop-loss (TP > SL).",

      bottomReal: "Real mode: transactions will be signed and broadcast.",
      bottomSim: "Simulation mode: no transactions will be sent.",
      starting: "Starting…",
      startReal: "Start watching",
      startSim: "Start (simulate)",
    },
  },

  // ============================================================================
  // /tasks/[id] — detail page
  // ============================================================================
  taskDetail: {
    pageEyebrow: "Auto-exit",
    pageTitle: "Live status",
    backLabel: "All auto-exits",

    hero: {
      currentPrice: "Current price",
      lastTick: (time: string) => `last tick ${time}`,
      noTicks: "no ticks yet",
      bufferLabel: (duration: string) => `buffer ${duration}`,
    },

    controls: {
      restart: "Restart",
      resume: "Resume",
      pause: "Pause",
      delete: "Delete",
      deleteConfirm: "Delete this watcher? Its history goes with it.",
    },

    pool: {
      eyebrow: "Pool state",
      range: "Range",
      holdings: (sym: string) => `Holdings ${sym}`,
      feesPending: "Fees pending",
    },

    config: {
      eyebrow: "Configuration",
      position: "Position",
      triggers: "Triggers",
      pollInterval: "Poll interval",
      closeSlippage: "Close slippage",
      timeBuffer: "Time buffer",
      exitToken: "Exit token",
      exitSlippage: "Exit slippage",
    },

    triggerBlock: {
      tp: "Take profit",
      sl: "Stop loss",
      firedThisOne: "· fired this one",
      triggerMet: " · trigger met",
      awayFromCurrent: " from current",
      bufferLabel: (duration: string) => `buffer ${duration}`,
    },

    error: {
      header: "Auto-exit failed",
      diagnosedSlippage: "· diagnosed: slippage",
      slippageExplain: (slippagePct: string) =>
        `The pool moved more between the close quote and execution than your slippage tolerance of ${slippagePct} allowed. Orca / Meteora reverted the transaction to protect you from a worse-than-expected fill.`,
      positionIntact:
        "Your position is intact on-chain.",
      positionIntactCopy:
        " The close never executed, so the liquidity is still there. The watcher just stopped — restarting it would likely fail again unless the pool has fully settled.",
      recommended: "Recommended path:",
      recommendedCopy:
        " delete this failed auto-exit and configure a new one on the same position with higher slippage (try ",
      recommendedNormal: " for normal pairs, ",
      recommendedVolatile:
        " for volatile / shallow pools). Live tasks are immutable by design (ADR-013), so editing isn't possible.",
      nonSlippage:
        "This doesn't look like a slippage issue — possibly RPC congestion, a transient network error, or an account state problem. ",
      closeAttemptedYes: "The close attempt failed, so ",
      yourPositionIntact: "your position is still intact on-chain",
      noTokensMoved: " — no tokens moved.",
      closeAttemptedNo: "The watcher never reached the close step.",
      restartLine1: "Hitting ",
      restartLine2:
        " above usually resolves transient errors. If the same error returns across multiple restarts, treat it as structural and delete + reconfigure. ",
      troubleshootingGuide: "Read the troubleshooting guide →",
      restartButton: "Restart",
      deleteConfirm: "Delete this auto-exit? History goes with it.",
      cancel: "Cancel",
      deleteAndGo: "Yes — delete and go to position",
      setUpNew: "Set up new with higher slippage →",
      deleteCta: "Delete this auto-exit",
    },

    receipt: {
      closedHeader: "Position closed",
      closedSimulated: " · simulated",
      recoveredTitle: "Recovered from pool",
      receivedLabel: (sym: string) => `Received ${sym}`,
      feesA: "Fees A",
      feesB: "Fees B",
      solDeltaNote:
        "The actual SOL delta includes tx fees deducted and any rent recovered from closed accounts, which is why it can differ from the quoted liquidity amount.",
      actual: "actual ",
    },

    swap: {
      header: "Swapped",
      simulated: " · simulated",
      skippedTitle: "Exit swap · skipped",
      skippedFallback: "Nothing to swap.",
      input: "Input",
      outputEstimated: "Output (estimated)",
      outputMinimum: "Output (minimum)",
    },

    timeline: {
      eyebrow: "Activity",
      whatsInHere: "→ What's in here",
      events: (n: number) => `${n} ${n === 1 ? "event" : "events"}`,
      labels: {
        created: "Created",
        started: "Started",
        resumed: "Resumed",
        paused: "Paused",
        stopped: "Stopped",
        triggered: "Triggered",
        bufferStarted: "Buffer started",
        bufferReset: "Buffer reset",
        closed: "Closed",
        swapped: "Swapped",
        verifiedClose: "Close verified",
        verifiedSwap: "Swap verified",
        error: "Error",
      },
      descriptions: {
        createdGeneric: "Auto-exit created.",
        createdWith: (protocol: string, posShort: string) =>
          `Auto-exit created on ${protocol} for ${posShort}.`,
        started: "Watching the pool price.",
        resumed: "Watcher resumed after a pause.",
        pausedUser: "Paused by user.",
        pausedVaultLocked:
          "Paused — the vault was locked while the watcher was running.",
        pausedServerRestart:
          "Paused at boot — vault was locked after the server restarted.",
        pausedOther: (reason: string) => `Paused (${reason}).`,
        stopped: "Stopped manually. No further ticks.",
        triggered: (kind: string) =>
          `${kind} threshold crossed — preparing to close.`,
        bufferArmedTp: (duration: string) =>
          `Take-profit target crossed. Waiting ${duration} of sustained price before closing.`,
        bufferArmedSl: (duration: string) =>
          `Stop-loss target crossed. Waiting ${duration} of sustained price before closing.`,
        bufferResetTp:
          "Take-profit target no longer crossed — buffer cronómetro reset to zero.",
        bufferResetSl:
          "Stop-loss target no longer crossed — buffer cronómetro reset to zero.",
        closedDry:
          "Position closed in simulation — no transaction sent.",
        closedReal: "Position closed on-chain.",
        swapSkipped: (notes: string | null) =>
          notes ? `Exit swap skipped — ${notes}` : "Exit swap skipped.",
        swapDry: "Swap quoted in simulation — no transaction sent.",
        swapReal: "Proceeds swapped on-chain.",
        verifiedDeltas: (parts: string) => `On-chain delta: ${parts}`,
        verifiedNoChanges: "On-chain queried — no balance changes detected.",
        errorGeneric: "Unknown error.",
      },
    },
  },
};
