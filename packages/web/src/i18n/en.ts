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
    testMode: "Test · devnet",
    testModeTooltip: "Test mode (Solana devnet) — click to open settings",
    mainnetLive: "Mainnet · Live",
    mainnetLiveTooltip: "Real funds — every close signs a transaction on Solana mainnet",
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
  // Sidebar (sustituye al header global del rediseño anterior)
  // ============================================================================
  sidebar: {
    aria: {
      primary: "Primary",
    },
    workspaceLabel: "Workspace",
    nav: {
      dashboard: "Dashboard",
      wallet: "Wallet",
      positions: "Positions",
      autoExits: "History",
      settings: "Settings",
    },
    serverLabel: "Server",
    walletLabel: "Wallet",
    setupWallet: "Set up wallet",
    docs: "Docs",
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
    inRange: "In range",
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
    sim: "Simulated",
    simTooltip:
      "This auto-exit ran in simulation mode: no real on-chain transactions were executed.",
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
        "Auto-Exit watches your Orca and Meteora liquidity positions every few seconds and closes them when price hits your take-profit or stop-loss. It runs on this machine and signs with a wallet you control.",
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
      disclaimerLink:
        "→ Use at your own risk · disclaimer",
    },

    eyebrow: {
      whatIs: "→ What's a bot wallet",
    },

    dashboard: {
      eyebrow: "Overview",
      title: "Dashboard",
      descriptionLoading: "Reading positions for this wallet…",
      descriptionNone: "No LP positions detected in this wallet yet.",
      descriptionOne: "1 position detected — configure an auto-exit below.",
      descriptionMany: (n: number) =>
        `${n} positions detected in this wallet.`,
      lockedEyebrow: "Wallet locked",
      lockedBody: "Unlock it to arm any auto-exit.",
      lockedCta: "Unlock",
    },

    alerts: {
      lowBalanceEyebrow: "Low balance",
      lowBalanceBody: (sol: string, network: "mainnet" | "devnet") =>
        `Your bot has ${sol} SOL on ${network} — may not afford fees when closing. ${
          network === "devnet"
            ? "If your wallet has SOL on mainnet, switch network in /settings."
            : ""
        }`.trim(),
      lowBalanceCta: "Open wallet",
      balanceErrorEyebrow: "Couldn't check balance",
      balanceErrorBody:
        "The configured RPC didn't respond correctly. It may be rate-limited, misconfigured or down.",
      balanceErrorCta: "Open settings",
      errorsEyebrow: (n: number) =>
        n === 1 ? "1 auto-exit errored" : `${n} auto-exits errored`,
      errorsBody:
        "Something went wrong on the last close. Check the details and resume or stop.",
      errorsCta: "View in history",
      resumeEyebrow: (n: number) =>
        n === 1
          ? "1 auto-exit paused when the wallet was locked"
          : `${n} auto-exits paused when the wallet was locked`,
      resumeBody:
        "Resume them when you want to keep watching prices again.",
      resumeCta: "Resume all",
      resumeCtaPending: "Resuming…",
    },

    hub: {
      nowWatching: "Now watching",
      subtitle:
        "Each row closes itself the moment price crosses a target — take-profit up, stop-loss down.",
      openLedger: "History",
      poolPrice: "current pool price",
      statTp: "Take-profit",
      statSl: "Stop-loss",
      statNearest: "Nearest",
      bufferLabel: "BUFFER",
      loading: "Querying chain for positions of this wallet…",
      oneProtocolFailed: (msg: string) => `One protocol query failed: ${msg}`,
      rateLimitHintBefore: "Looks like Solana's public RPC is rate-limiting you — ",
      rateLimitHintLink: "configure a private RPC",
      rateLimitHintAfter: " (free tier, no leaks, takes a minute).",
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
      viewAll: "View all",
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
        "One auto-exit per position. Open it to see its live status or pause it. If you want different settings, delete the current one and set up a new one.",
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
    backToDashboard: "Dashboard",
    backToHistory: "History",

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
        " for volatile / shallow pools). Live auto-exits are immutable by design (ADR-013), so editing isn't possible.",
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

    // ---- Bloque G: detail mockup ----
    head: {
      protocol: {
        orca: "Orca Whirlpools",
        meteora: "Meteora DLMM",
      },
      armedPrefix: "Armed",
      taskShortPrefix: "auto-exit",
      pollingPrefix: "polling every",
      openInExplorer: "Open position on Solana explorer",
    },

    heroPanel: {
      liveLabel: "Pool price · live",
      liveMetaPrefix: (ago: string) => `Updated ${ago} · next poll in`,
      liveMetaNoTick: "no ticks yet",
      toTp: "To take-profit",
      toSl: "To stop-loss",
      poolRange: "Pool range",
      inRange: "In range",
      outOfRange: "Out of range",
      bandLegendRange: "Liquidity range — earning fees",
      bandLegendSl: "Stop-loss",
      bandLegendTp: "Take-profit",
      bandLegendPrice: "Live price",
      bandAria: (args: {
        lo: string;
        hi: string;
        rangeLo: string;
        rangeHi: string;
        sl: string | null;
        tp: string | null;
        currentPrice: string;
        inRange: boolean;
      }) =>
        `Price band from ${args.lo} to ${args.hi}. The liquidity range spans ${args.rangeLo} to ${args.rangeHi}.${
          args.sl ? ` Stop-loss trigger at ${args.sl}.` : ""
        }${args.tp ? ` Take-profit trigger at ${args.tp}.` : ""} Current pool price is ${args.currentPrice} — ${args.inRange ? "inside" : "outside"} the range.`,
      zoneTag: "Liquidity range",
    },

    triggerCard: {
      tp: "Take-profit",
      sl: "Stop-loss",
      armedBadge: "Armed",
      firedBadge: "Fired",
      distance: "Distance to trigger",
      reached: "trigger met",
      bufferFootTp: (price: string, duration: string) =>
        `Closes only after price holds ≥ ${price} for ${duration}`,
      bufferFootSl: (price: string, duration: string) =>
        `Closes only after price holds ≤ ${price} for ${duration}`,
      // (i18n key intencionalmente igual a la firma vieja — el precio ya
      // va sin sym; la denominación se ancla en el hero "1 X = Y Z".)
      noBufferFoot: "Closes on the next tick after the trigger.",
    },

    holdings: {
      title: "Position holdings",
      refreshed: "refreshed every 10s",
      liquidity: "Liquidity",
      pendingFees: "Pending fees",
      rangeStatus: "Range status",
      estimatedValue: "Estimated value",
      estimatedValueNote: "liquidity + pending fees",
      feesValueNote: (totalInQuote: string) =>
        `≈ ${totalInQuote} — collected on close`,
      rangeWithStatus: (lo: string, hi: string) =>
        `${lo} – ${hi} · earning fees`,
      rangeWhenOut: (lo: string, hi: string) =>
        `${lo} – ${hi} · not earning fees`,
      noFees: "—",
    },

    detailsPanel: {
      title: "Details",
      protocol: "Protocol",
      network: "Network",
      networkMainnet: "Mainnet",
      networkDevnet: "Devnet",
      exitToken: "Exit token",
      exitTokenNone: "none",
      timeBuffer: "Time buffer",
      pollInterval: "Poll interval",
      closeSlippage: "Close slippage",
      swapSlippage: "Swap slippage",
      positionMint: "Position mint",
      bufferDash: "—",
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
          "Paused — the wallet was locked while the watcher was running.",
        pausedServerRestart:
          "Paused at boot — the wallet was locked after the server restarted.",
        pausedOther: (reason: string) => `Paused (${reason}).`,
        stopped: "Stopped manually. No further ticks.",
        triggered: (kind: string) =>
          `${kind} threshold crossed — preparing to close.`,
        bufferArmedTp: (duration: string) =>
          `Take-profit target crossed. Waiting ${duration} of sustained price before closing.`,
        bufferArmedSl: (duration: string) =>
          `Stop-loss target crossed. Waiting ${duration} of sustained price before closing.`,
        bufferResetTp:
          "Take-profit target no longer crossed — buffer timer reset to zero.",
        bufferResetSl:
          "Stop-loss target no longer crossed — buffer timer reset to zero.",
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

  // ============================================================================
  // /tasks — historical list
  // ============================================================================
  tasksList: {
    pageEyebrow: "History",
    pageTitle: "History.",
    pageDescription:
      "Closes and errors from past auto-exits. Live ones live in the dashboard.",
    backLabel: "Home",
    noMatch: "No auto-exits match this filter.",
    emptyEyebrow: "Empty",
    emptyTitle: "No closes or errors yet.",
    emptyBody:
      "When an auto-exit closes — because price hit the trigger, you stopped it manually, or it errored — it will appear here. Live positions being watched live in the dashboard.",
    emptyCta: "Go to dashboard →",
    filters: {
      completed: "Completed",
      errors: "Errors",
    },
    cols: {
      status: "Status",
      position: "Position",
      trigger: "Trigger",
      closedAt: "Closed by",
      result: "Result",
      when: "When",
    },
  },

  // ============================================================================
  // /settings — server defaults + network panel
  // ============================================================================
  settings: {
    pageEyebrow: "Settings",
    pageTitle: "Defaults for this server.",
    pageDescription:
      "RPC, slippage and polling defaults pre-fill the auto-exit form. The form lets you override per auto-exit; this is just the starting point.",
    backLabel: "Home",

    updater: {
      eyebrow: "Updates",
      title: "Check for new versions.",
      label: "Auto-check on startup",
      copy: "When on, the app asks GitHub for a newer version each time it starts. Off by default — that check is a network request that leaves your machine, so it's opt-in.",
      notTauriCopy:
        "Auto-update is only available in the installed desktop app. You're running this server outside Tauri, so updates are manual.",
      notTauriLink: "→ How to update manually",
    },

    networkSection: {
      eyebrow: "Network & RPC",
      title: "Where this server reads the chain.",
    },
    defaultsSection: {
      eyebrow: "Auto-exit defaults",
      title: "Pre-filled when you set one up.",
    },

    networkLabel: "Network",
    test: "TEST",
    real: "REAL",
    testCopy:
      "Test mode — auto-exits run on Solana devnet. No real funds at risk.",
    realCopy: "Real mode — auto-exits sign on Solana mainnet with real funds.",
    realLocked: "Real mode is locked on this server.",
    realLockedHow: "→ How to enable it",
    realLockedDisabled: "Locked — enable in server environment",
    switchTestPrompt:
      "Switch back to test mode? New auto-exits will run on Solana devnet.",

    confirmReal: {
      title: "Confirm switch to real mode",
      body: "Every auto-exit you create after this will sign transactions on Solana mainnet with real funds. Close transactions cost real SOL; price moves affect real money. There is no undo on a triggered close.",
      bullet1Strong: "RPC URL",
      bullet1Rest:
        " below to a mainnet endpoint (Helius, QuickNode, Triton, or your own node). The public devnet URL won't work.",
      bullet1Prefix: "Update ",
      bullet2:
        "Existing auto-exits keep their original network — they don't auto-migrate. Only new ones will be on mainnet.",
      bullet3: "Re-test your strategy on devnet before flipping the switch.",
      understood:
        "I understand this will sign transactions with real funds and I've updated my RPC URL.",
      disclaimerLink: "→ Disclaimer · the tool comes with no warranty",
      cancel: "Cancel",
      switching: "Switching…",
      confirmCta: "Confirm · use real funds",
    },

    rpc: {
      label: "RPC URL",
      hint: "any Solana JSON-RPC endpoint",
      mainnetWarning:
        "The public mainnet-beta endpoint is heavily rate-limited and not reliable for a watcher. Use Helius, QuickNode, Triton, or a node you run.",
      devnetWarning:
        "The public devnet endpoint is rate-limited. For sustained use swap to Helius, QuickNode, Triton, or a node you run.",
      useDefault: (network: string) => `use ${network} default`,
      testCta: "Test connection",
      testing: "Testing…",
      testOk: (version: string, latencyMs: number) =>
        `OK · ${version} · ${latencyMs} ms`,
      testFailPrefix: "RPC test failed: ",
    },

    slippage: {
      label: "Close slippage",
      legacyStored: (bps: number) =>
        `Currently stored: ${bps} bps. Pick a preset to update.`,
      copy05:
        "tight; reliable only on deep stablecoin pairs (USDC/USDT). Triggers may fail to complete in volatile minutes.",
      copy1:
        "Works for most pairs in normal volatility. Solid balance between protection and reliability.",
      copy1Recommended: "recommended default",
      copy2:
        "for volatile pairs (low-cap, memecoin pools). The price has to drift a lot for the close to revert.",
      copy5:
        "only when the close",
      copy5Must: "must",
      copy5Rest:
        " complete. Accepts a high price impact tax in exchange for near-zero revert risk.",
      docsLink: "→ How slippage affects close transactions",
    },

    exitSlippage: {
      label: "Exit-swap slippage",
      legacyStored: (bps: number) =>
        `Currently stored: ${bps} bps. Pick a preset to update.`,
      copyPart1:
        "Only used when an auto-exit also selects an exit token. Same scale as above — same recommendation: ",
      copyPart2: " for everyday pairs, ",
      copyPart3: " when the pool is shallow or volatile.",
    },

    poll: {
      label: "Poll interval",
      legacyStored: (s: string) =>
        `Currently stored: ${s}s. Pick a preset to update — the previous default of 5s was too aggressive on most RPC providers.`,
      copy10:
        " · fastest reaction. Only worth it for triggers ",
      copy10Without: "without",
      copy10Rest:
        " time buffer and on a paid RPC (8.6k requests/day per auto-exit — burns Helius free tier in 12 days).",
      copy30: " · ",
      copy30Recommended: "recommended default",
      copy30Rest:
        ". Catches every relevant move (LP prices don't jump 5% in 20s) and fits comfortably in Helius free tier with a few watchers running.",
      copy1min:
        " · cheap on RPC. Perfect when you're using time buffers — the hours-long buffer wait dwarfs the polling cadence.",
      copy5min:
        " · only for very long buffers (days) or stable, slow pools. With buffer-less triggers you may miss the cross.",
      docsLink: "→ Polling interval, RPC cost, and buffers",
    },

    perTaskNote:
      "Slippage settings above can be overridden per auto-exit on the configure form. Poll interval is server-wide; the form does not expose a per auto-exit override. Changing a default here only affects new auto-exits.",

    lowBalance: {
      eyebrow: "Dashboard",
      title: "Low balance threshold.",
      label: "Warn when SOL balance falls below",
      unit: "SOL",
      copy:
        "Affects only the dashboard callout, not the watcher. Set to 0 to disable. Default 0.05 SOL covers ~10 closes + ATA creation.",
      invalid:
        "Enter a number between 0 and 5 SOL.",
    },

    resetPrompt:
      "Reset RPC URL, slippage and poll interval to defaults?\n\nYour network choice (TEST / REAL) is preserved — switch it from the toggle above if you need to.",
    resetCta: "Reset to defaults",
  },

  // ============================================================================
  // /wallet
  // ============================================================================
  wallet: {
    pageEyebrow: "Wallet",
    pageTitle: "Your bot's wallet.",
    pageDescription:
      "The account the bot uses to open and close your auto-exits. It lives encrypted on your machine and only unlocks when you unlock it.",
    backLabel: "Home",
    encryptionLink: "→ How encryption and key storage work",
    loading: "Loading wallet status…",
    backendError: (msg: string) => `Cannot reach the backend: ${msg}`,

    scope: {
      eyebrow: "Scope",
      body:
        "Whatever key you provide, only that single address is exposed to this server — never a seed phrase, never other accounts. The standard practice is to use an account dedicated to active operations, not the one where you store cold holdings.",
    },

    noVault: {
      eyebrow: "No wallet",
      title: "Set up the bot wallet to begin.",
      body:
        "Generate a fresh keypair on this machine, or import the private key of a single Solana account from Phantom, Backpack, or the Solana CLI. The key is encrypted with a passphrase and used only to sign the closes you configure.",
      cta: "Set up bot wallet →",
      docs: "→ Read about the three paths",
    },

    locked: {
      eyebrow: "Wallet is locked",
      bodyWithAddress: (addr: string) =>
        `A keypair is encrypted on disk for ${addr}. Enter the passphrase to load it into memory.`,
      bodyNoAddress:
        "A keypair is encrypted on disk. Enter the passphrase to load it into memory.",
      passphraseLabel: "Passphrase",
      unlocking: "Unlocking…",
      unlock: "Unlock",
    },

    unlocked: {
      eyebrow: "Wallet unlocked",
      addressDisplay: {
        copy: "Copy",
        copied: "Copied",
        showFull: "Show full",
        showTruncated: "Show truncated",
        viewOnExplorer: "View on Solscan",
      },
      body:
        "The keypair is in memory. It will be used to sign close and swap transactions for armed auto-exits.",
      // Lock panel — visible solo cuando la wallet está unlocked. Explica
      // las consecuencias de lockear, porque el botón rompe el use case
      // 'set and forget' (los watchers se pausan).
      lockEyebrow: "Lock",
      lockTitle: "Lock the wallet",
      lockExplainP1:
        "Removes the decrypted key from memory. The encrypted file stays on disk — unlocking takes your passphrase again.",
      lockExplainP2:
        "Active auto-exits pause while the wallet is locked and resume when you unlock. Useful if you'll be away for a long stretch and prefer the bot to stop watching.",
      lockExplainTradeoff:
        "→ Security notes",
      lockButton: "Lock wallet",
      locking: "Locking…",
      // Kept for backwards compat — old call sites can be removed later.
      lock: "Lock",
    },

    danger: {
      eyebrow: "Danger zone",
      docsLink: "→ What deleting actually does",
      explainReset:
        "Permanently delete the encrypted wallet file. The wallet on-chain is not affected — only this server's encrypted copy is removed.",
      explainLostPass:
        "If you don't remember the passphrase, deleting the encrypted file is the only way out. The wallet on-chain stays safe; you just lose this server's encrypted copy.",
      confirmDelete: "Delete the encrypted wallet file?",
      cancel: "Cancel",
      yesDelete: "Yes, delete",
      deleteCta: "Delete wallet",
    },
  },

  // ============================================================================
  // ConnectWalletModal
  // ============================================================================
  modal: {
    closeAria: "Close",
    title: "Set up bot wallet",
    intro:
      "An account whose key lives encrypted on this machine. The bot uses it to sign closes when triggers fire — including while you're away.",
    notPhantom:
      "Not a Phantom-style \"connect wallet\". The bot can't pop up a signing prompt at 3am — it needs the key on disk. Here are the three ways to put one there:",
    disclaimerLink: "→ Disclaimer · use at your own risk",
    tabs: {
      generate: "Generate",
      importKey: "Import key",
      advancedJson: "Advanced · JSON",
    },
    generate: {
      title: "Generate a fresh keypair",
      body:
        "We create a new ed25519 keypair on this machine, encrypt it with your passphrase, and show you the secret once so you can save it in your password manager. After that, only the encrypted file remains on disk.",
      hint: "≥ 8 characters",
      passphraseLabel: "Passphrase",
      confirmLabel: "Confirm",
      errorShort: "Passphrase must be at least 8 characters.",
      errorMismatch: "Passphrases don't match.",
      generating: "Generating…",
      submitCta: "Generate and encrypt",
      finePrint:
        "Recommended if you don't already have a dedicated operational account.",
    },
    importBase58: {
      title: "Import a key (base58)",
      body:
        "Paste the private key of a single Solana account in base58 form — typically the one Phantom or Backpack exports for a specific account (≈ 88 characters). Seed phrases are not accepted, so only this one address ever reaches this server.",
    },
    importJson: {
      title: "Advanced — JSON byte array",
      body:
        "Paste the wallet.json contents from Solana CLI — a JSON array of 64 integers, e.g. [12, 45, 200, …]. Same scope as the Import key tab: this represents a single account.",
    },
    importCommon: {
      secretLabel: "Secret key",
      secretHintBase58: "≈ 88 base58 characters",
      secretHintJson: "[12, 34, 56, …]  · 64 integers",
      placeholderBase58: "3suF5rw3…",
      placeholderJson: "[12, 45, 200, …, 8]",
      passphraseLabel: "Passphrase",
      confirmLabel: "Confirm",
      passphraseHint: "≥ 8 characters",
      errorShort: "Passphrase must be at least 8 characters.",
      errorMismatch: "Passphrases don't match.",
      importing: "Importing…",
      submitCta: "Encrypt and unlock",
    },
    importWarning: {
      eyebrow: "Operational scope",
      body:
        "The key is held encrypted at rest on this machine and decrypted in memory only while the wallet is unlocked. If both your passphrase and the encrypted wallet file were compromised at once, the assets at this single address could be moved by the attacker — nothing else in your wallet, no other accounts, no seed-derived addresses.",
      body2:
        "Standard practice is to import an account dedicated to active operations (a \"hot\" account separate from cold holdings), not the account where you store everything.",
      readMore: "→ Read the precise blast radius",
    },
    success: {
      title: "Save your secret. Now.",
      bodyIntro:
        "A new bot wallet has been generated, encrypted with your passphrase, and unlocked. Below is the secret key.",
      bodyStrong: "This is the only time you'll see it.",
      secretEyebrow: "Secret key · base58",
      reveal: "reveal",
      hide: "hide",
      copy: "copy",
      copied: "copied",
      savedCheckbox:
        "I've saved the secret key in a safe place (password manager, offline backup). I understand it won't be shown again.",
      nextEyebrow: "Next",
      step1Body:
        "Import this secret into Phantom or Backpack as a new account (Settings → Add wallet → Import private key). The bot wallet then sits alongside your main and you can use it from there.",
      step2BodyPrefix: "Fund it at ",
      step2BodySuffix:
        " with SOL (for fees) and the tokens you want it to manage.",
      step3Body:
        "Open an LP position on Orca while the bot account is selected in your wallet. It will appear under Positions here for auto-exit setup.",
      alternative:
        "Alternative: transfer the NFT of an existing position from any account you control to this address.",
      continueCta: "Continue",
    },
    address: {
      label: "Address",
      balance: "Balance",
      faucetCta: "→ Get devnet SOL from the faucet",
      scanHint: "scan to send funds",
    },
  },
};
