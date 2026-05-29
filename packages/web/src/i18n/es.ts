import type { en } from "./en";

/**
 * Spanish dictionary. La tipo `typeof en` fuerza que esta tabla matchee
 * exactamente la estructura del inglés — si añades una key allá, TS te
 * obliga a añadirla aquí. "auto-exit" se mantiene en inglés (es el
 * nombre del producto). Términos como "take-profit" / "stop-loss" se
 * traducen porque son conceptos de trading, no marcas.
 */
export const es: typeof en = {
  common: {
    save: "Guardar",
    saving: "Guardando…",
    saveChanges: "Guardar cambios",
    cancel: "Cancelar",
    delete: "Borrar",
    deleting: "Borrando…",
    confirm: "Confirmar",
    loading: "Cargando…",
    yes: "Sí",
    back: "Atrás",
    home: "Inicio",
    saved: "Guardado.",
    unsaved: "Cambios sin guardar.",
    allSaved: "Todo guardado.",
    open: "abrir →",
    details: "detalles →",
    autoExit: "auto-exit →",
    viewAll: "Ver todos →",
    readMore: "→ Leer más",
    docs: "docs",
    noData: "sin datos",
    refresh: "Refrescar",
  },

  header: {
    docs: "Docs",
    settings: "Ajustes",
    botRunning: "bot en marcha",
    botUnreachable: "bot inalcanzable",
    connecting: "conectando",
    testMode: "Test · devnet",
    testModeTooltip: "Modo test (Solana devnet) — pulsa para abrir ajustes",
    mainnetLive: "Mainnet · Live",
    mainnetLiveTooltip: "Fondos reales — cada cierre firma una transacción en Solana mainnet",
    onOrcaMeteora: "en Orca · Meteora",
    languageToggle: "Idioma",
  },

  vaultChip: {
    wallet: "wallet",
    setupWallet: "configurar wallet",
    walletLocked: "wallet bloqueada",
    walletUnlocked: "wallet desbloqueada",
  },

  sidebar: {
    aria: {
      primary: "Primaria",
    },
    workspaceLabel: "Workspace",
    nav: {
      dashboard: "Dashboard",
      wallet: "Wallet",
      positions: "Posiciones",
      autoExits: "Histórico",
      settings: "Ajustes",
    },
    serverLabel: "Server",
    walletLabel: "Wallet",
    setupWallet: "Configurar wallet",
    docs: "Docs",
  },

  status: {
    idle: {
      label: "Listo",
      description: "Configurado pero aún no vigilando.",
    },
    armed: {
      label: "Vigilando",
      description: "Consultando el pool para la condición del trigger.",
    },
    triggered: {
      label: "Objetivo alcanzado",
      description: "Condición del trigger cumplida. Preparando el cierre.",
    },
    closing: {
      label: "Cerrando posición",
      description:
        "Enviando el cierre (y el swap, si está configurado). Tarda unos segundos.",
    },
    done: {
      label: "Completado",
      description: "Cerrado limpiamente. Mira el resultado abajo.",
    },
    error: {
      label: "Detenido — error",
      description: "Algo salió mal. Revisa los detalles abajo.",
    },
    paused: {
      label: "Pausado",
      description: "No está vigilando. Reanuda para continuar.",
    },
    stopped: {
      label: "Detenido",
      description: "Detenido por el usuario.",
    },
    noExit: "Sin auto-exit",
  },

  format: {
    inRange: "Dentro del rango",
    outOfRange: "Fuera del rango",
    bufferOff: "off",
    bufferMet: "buffer cumplido",
    lessThan1mLeft: "menos de 1m restante",
    minutesLeft: (m: number) => `${m}m restante${m === 1 ? "" : "s"}`,
    hoursLeft: (h: number, m: number) =>
      m > 0 ? `${h}h ${m}m restantes` : `${h}h restante${h === 1 ? "" : "s"}`,
    daysLeft: (d: number, h: number) =>
      h > 0 ? `${d}d ${h}h restantes` : `${d}d restante${d === 1 ? "" : "s"}`,
    justNow: "ahora mismo",
    secondsAgo: (s: number) => `hace ${s}s`,
    minutesAgo: (m: number) => `hace ${m}m`,
    hoursAgo: (h: number) => `hace ${h}h`,
    awayFromCurrent: "desde el precio actual",
    triggerAlreadyTrue: " · trigger ya activo",
    triggerMet: " · trigger cumplido",
    firedThisOne: "· disparado por este",
    sim: "Simulado",
    simTooltip:
      "Este auto-exit corrió en modo simulación: no se ejecutaron transacciones reales en cadena.",
    simulation: "· simulación",
  },

  home: {
    firstRun: {
      eyebrow: "auto-exits para pools de liquidez en Solana",
      titleLine1: "Pon las condiciones.",
      titleLine2: "Despreocúpate.",
      intro:
        "Auto-Exit vigila tus posiciones de liquidez en Orca y Meteora cada pocos segundos y las cierra cuando el precio alcanza tu take-profit o stop-loss. Corre en esta máquina y firma con una wallet que tú controlas.",
      stepsEyebrow: "Cómo funciona",
      stepsTitle: "Tres pasos, después nada.",
      step1Title: "Bot wallet",
      step1Body:
        "Una cuenta Solana dedicada cuya clave vive cifrada en esta máquina. El bot la usa para firmar la transacción de cierre cuando los triggers se disparan — incluso mientras duermes. Eso es lo que un popup tipo Phantom no puede hacer.",
      step2Title: "Posiciones con fondos",
      step2Body:
        "Pon SOL (para fees) y los tokens que quieras gestionar en la bot wallet. Abre nuevas posiciones LP desde ella en Orca, o transfiere el NFT de una posición existente.",
      step3Title: "Triggers",
      step3Body:
        "Para cada posición, configura un precio de take-profit, un stop-loss, o ambos. El bot cierra cuando se cumpla cualquiera primero; opcionalmente swappea las ganancias a un stable.",
      ctaCreateWallet: "Crear la wallet del bot →",
      ctaReadGuide: "Lee la guía completa",
      stepHint: "Paso 1 de 3 · puedes parar y reanudar en cualquier momento.",
      localEyebrow: "Stack local",
      localBody:
        "El servidor solo escucha en localhost. La clave de tu wallet vive cifrada en disco con tu passphrase y solo se descifra en memoria mientras está desbloqueada — nada sobre tu wallet, posiciones o trades sale de esta máquina.",
      disclaimerLink: "→ Uso bajo tu propia responsabilidad · disclaimer",
    },

    dashboard: {
      eyebrow: "Resumen",
      title: "Dashboard",
      descriptionLoading: "Leyendo posiciones de esta wallet…",
      descriptionNone: "Aún no hay posiciones LP en esta wallet.",
      descriptionOne: "1 posición detectada — configura un auto-exit abajo.",
      descriptionMany: (n: number) =>
        `${n} posiciones detectadas en esta wallet.`,
      lockedEyebrow: "Wallet bloqueada",
      lockedBody: "Desbloquéala para armar cualquier auto-exit.",
      lockedCta: "Desbloquear",
    },

    alerts: {
      lowBalanceEyebrow: "Balance bajo",
      lowBalanceBody: (sol: string, network: "mainnet" | "devnet") =>
        `Tu bot tiene ${sol} SOL en ${network} — puede no pagar fees al cerrar. ${
          network === "devnet"
            ? "Si tu wallet tiene SOL en mainnet, cambia la red en /settings."
            : ""
        }`.trim(),
      lowBalanceCta: "Ver wallet",
      balanceErrorEyebrow: "No se pudo verificar el balance",
      balanceErrorBody:
        "El RPC configurado no respondió correctamente. Puede estar rate-limited, mal configurado o caído.",
      balanceErrorCta: "Ver ajustes",
      errorsEyebrow: (n: number) =>
        n === 1 ? "1 auto-exit en error" : `${n} auto-exits en error`,
      errorsBody:
        "Algo salió mal en el último cierre. Revisa qué pasó y reanuda o detén.",
      errorsCta: "Ver en histórico",
      resumeSafeEyebrow: (n: number) =>
        n === 1
          ? "1 auto-exit listo para reanudar"
          : `${n} auto-exits listos para reanudar`,
      resumeSafeBody:
        "El precio no ha cruzado sus triggers — reanudar solo vuelve a vigilar.",
      resumeSafeCta: "Reanudar estos",
      resumeSafeCtaPending: "Reanudando…",
      resumeReviewEyebrow: (n: number) =>
        n === 1
          ? "1 auto-exit cruzó su trigger mientras estaba bloqueado"
          : `${n} auto-exits cruzaron su trigger mientras estaban bloqueados`,
      resumeReviewBody:
        "Reanudarlos los cerraría ya mismo (o tras el buffer). Abre cada uno para decidir.",
      resumeReviewLink: "Revisar",
      resumeCrossedTakeProfit: "Cruzó el take-profit",
      resumeCrossedStopLoss: "Cruzó el stop-loss",
      resumeUnverified: "No se pudo leer el precio",
      dbBloatedEyebrow: "Base de datos inusualmente grande",
      dbBloatedBody: (mb: string) =>
        `El archivo SQLite pesa ahora ${mb} MB. El uso normal está muy por debajo — esto puede indicar un append desbocado. Revisa el histórico y considera exportar + limpiar.`,
      dbBloatedCta: "Ver histórico",
    },

    eyebrow: {
      whatIs: "Qué es una bot wallet",
    },

    hub: {
      nowWatching: "Vigilando ahora",
      subtitle:
        "Cada fila se cierra sola en cuanto el precio cruza un umbral — take-profit arriba, stop-loss abajo.",
      openLedger: "Histórico",
      poolPrice: "precio actual del pool",
      statTp: "Take-profit",
      statSl: "Stop-loss",
      statNearest: "Más cercano",
      bufferLabel: "BUFFER",
      loading: "Consultando la cadena para posiciones de esta wallet…",
      oneProtocolFailed: (msg: string) => `Una query de protocolo falló: ${msg}`,
      rateLimitHintBefore: "El RPC público de Solana te está limitando las queries — ",
      rateLimitHintLink: "configura un RPC privado",
      rateLimitHintAfter: " (free tier, sin fugas, un minuto de setup).",
    },

    emptyHub: {
      eyebrow: "Vacío",
      title: "Esta wallet no tiene posiciones LP todavía.",
      intro:
        "El bot solo puede cerrar posiciones cuyo NFT esta address posea. Hay dos formas de poner una aquí.",
      addressLabel: "Address de la bot wallet",
      copy: "copiar",
      copied: "copiada",
      path1Title: "Abre nuevas posiciones desde la cuenta del bot",
      path1Body:
        "Importa el secreto del bot en Phantom o Backpack como cuenta nueva (Settings → Add wallet → Import private key). Cambia a ella, luego abre un LP en Orca o Meteora con normalidad. El NFT de la posición pertenecerá a esta misma address y aparecerá aquí al refrescar.",
      path2Title: "Transfiere un NFT de posición existente",
      path2Body:
        "Desde cualquier cuenta que tenga ahora mismo una posición Whirlpool o DLMM, envía el NFT de la posición a la address de arriba. La propiedad pasa a la bot wallet y la posición queda cerrable desde aquí. Acuérdate de dejar suficiente SOL en la bot wallet para los fees de close + swap.",
      openOrca: "abrir orca",
      openMeteora: "abrir meteora",
      stepByStep: "Guía paso a paso",
    },

    activity: {
      eyebrow: "Histórico de transacciones",
      title: "Cierres, swaps y fallos.",
      viewAll: "Ver todos",
      headerWhen: "Cuándo",
      headerPosition: "Posición",
      headerTrigger: "Trigger",
      headerResult: "Resultado",
      headerTxError: "Tx / Error",
      resultClosed: "Cerrada",
      resultFailed: "Falló",
      resultStopped: "Detenida",
      slippageTag: "· slippage",
      simulated: "simulada",
    },
  },

  configure: {
    pageEyebrow: "Posición",
    pageTitle: "Configura el cierre.",
    backLabel: "Inicio",
    positionNotInWallet: (mint: string) =>
      `La posición ${mint} no está en esta wallet.`,

    needWallet: {
      lockedEyebrow: "Wallet bloqueada",
      noVaultEyebrow: "Sin wallet",
      lockedTitle: "Desbloquea para configurar.",
      noVaultTitle: "Configura tu wallet primero.",
      unlockCta: "Desbloquear wallet →",
      setupCta: "Ir a la wallet →",
    },

    existing: {
      title: "Esta posición ya tiene un auto-exit.",
      intro:
        "Un auto-exit por posición. Ábrelo para ver su estado en vivo o pausarlo. Si quieres distintos ajustes, borra el actual y crea uno nuevo.",
      fieldTakeProfit: "Take profit",
      fieldStopLoss: "Stop loss",
      fieldLastPrice: "Último precio",
      fieldNearest: "Más cercano",
      deleteConfirm: "¿Borrar el auto-exit actual?",
      cancel: "Cancelar",
      yesDelete: "Sí, borrar",
      deleteCta: "Borrar auto-exit",
      openCta: "Abrir auto-exit →",
    },

    recap: {
      pairWithProtocol: (protocol: string, a: string, b: string) =>
        `${protocol} · ${a} / ${b}`,
      labelRange: "Rango",
      labelHoldings: (sym: string) => `Holdings ${sym}`,
      labelFeesPending: "Fees pendientes",
      loading: "Cargando estado de la posición…",
      currentPrice1To1: (a: string, price: string, b: string) =>
        `1 ${a} = ${price} ${b}`,
    },

    form: {
      section1: "1 — Cuándo cerrar",
      section1Intro:
        "Activa take-profit, stop-loss, o ambos. El auto-exit cierra cuando se alcance cualquiera de los dos precios (lo que pase primero).",
      howTriggersWork: "→ Cómo funcionan los triggers",
      takeProfit: "Take profit",
      stopLoss: "Stop loss",
      tpDescription: (a: string, b: string) =>
        `cierra cuando 1 ${a} suba a un precio objetivo en ${b}`,
      slDescription: (a: string, b: string) =>
        `cierra cuando 1 ${a} baje a un precio objetivo en ${b}`,
      fromCurrent: "desde el actual",
      targetPriceLabel: (a: string, b: string) =>
        `Precio objetivo (${b} por ${a})`,
      currentHint: (price: string) => `actual ${price}`,
      timeBuffer: "Time buffer",
      bufferOnCopy: (direction: "above" | "below") =>
        `Cierra solo si el precio se mantiene ${direction === "above" ? "por encima" : "por debajo"} del objetivo durante al menos este tiempo. Si sale de la zona, el cronómetro se resetea.`,
      bufferOffCopy:
        "Dispara en cuanto el precio cruce el objetivo — sin espera.",
      readMoreBuffer: "→ Leer más",

      section2: "2 — Qué hacer con el output",
      section2Docs: "docs",
      exitKeepBoth: "Mantener ambos tokens",
      exitSell: (sym: string) => `Vender a ${sym}`,
      exitNoneCopy:
        "Ambos tokens vuelven a tu wallet a medida que la posición los libera.",
      exitWithCopy: (sym: string, slippagePct: string) =>
        `Tras el cierre, la parte que no es ${sym} se swappea en el mismo pool con hasta ${slippagePct}% de tolerancia de slippage.`,

      section3: "3 — Seguridad",
      closeSlippageLabel: "Tolerancia de slippage al cerrar",
      closeSlippageCopy:
        "Cuánto se permite que se mueva el precio del pool entre el envío y la ejecución antes de que la transacción de cierre revierta. Valores más altos se completan de forma más fiable en mercados volátiles; valores más bajos dan una garantía de precio más estricta pero pueden fallar y reintentar con más frecuencia.",
      readMoreSlippage: "→ Leer más",

      advancedShow: "+ Mostrar opciones avanzadas",
      advancedHide: "− Ocultar opciones avanzadas",
      exitSwapSlippageLabel: "Slippage del swap de salida",

      errorAtLeastOne:
        "Activa take-profit, stop-loss, o ambos. Al menos uno es obligatorio.",
      errorTpGtSl:
        "El take-profit debe ser mayor que el stop-loss (TP > SL).",

      bottomReal: "Modo real: las transacciones se firmarán y enviarán.",
      bottomSim: "Modo simulación: no se enviará ninguna transacción.",
      starting: "Iniciando…",
      startReal: "Empezar a vigilar",
      startSim: "Empezar (simular)",
    },
  },

  taskDetail: {
    pageEyebrow: "Auto-exit",
    pageTitle: "Estado en vivo",
    backToDashboard: "Dashboard",
    backToHistory: "Histórico",

    hero: {
      currentPrice: "Precio actual",
      lastTick: (time: string) => `último tick ${time}`,
      noTicks: "aún sin ticks",
      bufferLabel: (duration: string) => `buffer ${duration}`,
    },

    controls: {
      restart: "Reiniciar",
      resume: "Reanudar",
      pause: "Pausar",
      delete: "Borrar",
      deleteConfirm: "¿Borrar este watcher? Su historial se va con él.",
    },

    pool: {
      eyebrow: "Estado del pool",
      range: "Rango",
      holdings: (sym: string) => `Holdings ${sym}`,
      feesPending: "Fees pendientes",
    },

    config: {
      eyebrow: "Configuración",
      position: "Posición",
      triggers: "Triggers",
      pollInterval: "Intervalo de poll",
      closeSlippage: "Slippage de cierre",
      timeBuffer: "Time buffer",
      exitToken: "Token de salida",
      exitSlippage: "Slippage de salida",
    },

    triggerBlock: {
      tp: "Take profit",
      sl: "Stop loss",
      firedThisOne: "· disparado por este",
      triggerMet: " · trigger cumplido",
      awayFromCurrent: " desde el actual",
      bufferLabel: (duration: string) => `buffer ${duration}`,
    },

    error: {
      header: "Auto-exit falló",
      diagnosedSlippage: "· diagnóstico: slippage",
      slippageExplain: (slippagePct: string) =>
        `El pool se movió entre la cotización del cierre y la ejecución más de lo que tu tolerancia de slippage de ${slippagePct} permitía. Orca / Meteora revirtieron la transacción para protegerte de un fill peor de lo esperado.`,
      positionIntact: "Tu posición está intacta on-chain.",
      positionIntactCopy:
        " El cierre nunca se ejecutó, así que la liquidez sigue ahí. El watcher solo se detuvo — reiniciarlo probablemente fallaría de nuevo a no ser que el pool se haya calmado.",
      recommended: "Recomendado:",
      recommendedCopy:
        " borra este auto-exit fallido y configura uno nuevo en la misma posición con más slippage (prueba ",
      recommendedNormal: " para pairs normales, ",
      recommendedVolatile:
        " para pools volátiles o poco profundos). Los auto-exits vivos son inmutables por diseño (ADR-013), así que editar no es posible.",
      nonSlippage:
        "Esto no parece un problema de slippage — posiblemente congestión del RPC, un error de red transitorio o un problema de estado de cuenta. ",
      closeAttemptedYes: "El intento de cierre falló, así que ",
      yourPositionIntact: "tu posición sigue intacta on-chain",
      noTokensMoved: " — no se movió ningún token.",
      closeAttemptedNo: "El watcher nunca llegó al paso de cierre.",
      restartLine1: "Pulsar ",
      restartLine2:
        " arriba normalmente resuelve los errores transitorios. Si el mismo error vuelve tras varios reintentos, trátalo como estructural y borra + reconfigura. ",
      troubleshootingGuide: "Leer la guía de troubleshooting →",
      restartButton: "Reiniciar",
      deleteConfirm: "¿Borrar este auto-exit? El historial se va con él.",
      cancel: "Cancelar",
      deleteAndGo: "Sí — borrar e ir a la posición",
      setUpNew: "Crear uno nuevo con más slippage →",
      deleteCta: "Borrar este auto-exit",
    },

    receipt: {
      closedHeader: "Posición cerrada",
      closedSimulated: " · simulada",
      recoveredTitle: "Recuperado del pool",
      receivedLabel: (sym: string) => `Recibido ${sym}`,
      feesA: "Fees A",
      feesB: "Fees B",
      solDeltaNote:
        "El delta real de SOL incluye fees de tx descontadas y cualquier rent recuperada de cuentas cerradas, por eso puede diferir del importe de liquidez cotizado.",
      actual: "real ",
    },

    swap: {
      header: "Swappeado",
      simulated: " · simulado",
      skippedTitle: "Swap de salida · saltado",
      skippedFallback: "Nada que swappear.",
      input: "Input",
      outputEstimated: "Output (estimado)",
      outputMinimum: "Output (mínimo)",
    },

    // ---- Bloque G: detail mockup ----
    head: {
      protocol: {
        orca: "Orca Whirlpools",
        meteora: "Meteora DLMM",
      },
      armedPrefix: "Armado",
      taskShortPrefix: "auto-exit",
      pollingPrefix: "cada",
      openInExplorer: "Abrir la posición en el explorer de Solana",
    },

    heroPanel: {
      liveLabel: "Precio del pool · en vivo",
      liveMetaPrefix: (ago: string) =>
        `Actualizado ${ago} · próximo poll en`,
      liveMetaNoTick: "aún sin ticks",
      toTp: "Hasta take-profit",
      toSl: "Hasta stop-loss",
      poolRange: "Rango del pool",
      inRange: "En rango",
      outOfRange: "Fuera de rango",
      bandLegendRange: "Rango de liquidez — generando fees",
      bandLegendSl: "Stop-loss",
      bandLegendTp: "Take-profit",
      bandLegendPrice: "Precio en vivo",
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
        `Banda de precio de ${args.lo} a ${args.hi}. El rango de liquidez va de ${args.rangeLo} a ${args.rangeHi}.${
          args.sl ? ` Trigger de stop-loss en ${args.sl}.` : ""
        }${args.tp ? ` Trigger de take-profit en ${args.tp}.` : ""} Precio actual del pool: ${args.currentPrice} — ${args.inRange ? "dentro" : "fuera"} del rango.`,
      zoneTag: "Rango de liquidez",
    },

    triggerCard: {
      tp: "Take-profit",
      sl: "Stop-loss",
      armedBadge: "Armado",
      firedBadge: "Disparado",
      distance: "Distancia al trigger",
      reached: "trigger cumplido",
      bufferFootTp: (price: string, duration: string) =>
        `Cierra solo si el precio se mantiene ≥ ${price} durante ${duration}`,
      bufferFootSl: (price: string, duration: string) =>
        `Cierra solo si el precio se mantiene ≤ ${price} durante ${duration}`,
      noBufferFoot: "Cierra en el siguiente tick tras el trigger.",
    },

    holdings: {
      title: "Holdings de la posición",
      refreshed: "refrescado cada 10s",
      liquidity: "Liquidez",
      pendingFees: "Fees pendientes",
      rangeStatus: "Estado del rango",
      estimatedValue: "Valor estimado",
      estimatedValueNote: "liquidez + fees pendientes",
      feesValueNote: (totalInQuote: string) =>
        `≈ ${totalInQuote} — se recogen al cerrar`,
      rangeWithStatus: (lo: string, hi: string) =>
        `${lo} – ${hi} · generando fees`,
      rangeWhenOut: (lo: string, hi: string) =>
        `${lo} – ${hi} · sin generar fees`,
      noFees: "—",
    },

    detailsPanel: {
      title: "Detalles",
      protocol: "Protocolo",
      network: "Red",
      networkMainnet: "Mainnet",
      networkDevnet: "Devnet",
      exitToken: "Token de salida",
      exitTokenNone: "ninguno",
      timeBuffer: "Time buffer",
      pollInterval: "Intervalo de poll",
      closeSlippage: "Slippage de cierre",
      swapSlippage: "Slippage de swap",
      positionMint: "Mint de la posición",
      bufferDash: "—",
    },

    timeline: {
      eyebrow: "Actividad",
      whatsInHere: "→ Qué hay aquí",
      events: (n: number) => `${n} ${n === 1 ? "evento" : "eventos"}`,
      labels: {
        created: "Creado",
        started: "Iniciado",
        resumed: "Reanudado",
        paused: "Pausado",
        stopped: "Detenido",
        triggered: "Disparado",
        bufferStarted: "Buffer iniciado",
        bufferReset: "Buffer reseteado",
        closed: "Cerrado",
        swapped: "Swappeado",
        verifiedClose: "Cierre verificado",
        verifiedSwap: "Swap verificado",
        error: "Error",
      },
      descriptions: {
        createdGeneric: "Auto-exit creado.",
        createdWith: (protocol: string, posShort: string) =>
          `Auto-exit creado en ${protocol} para ${posShort}.`,
        started: "Vigilando el precio del pool.",
        resumed: "Watcher reanudado tras una pausa.",
        pausedUser: "Pausado por el usuario.",
        pausedVaultLocked:
          "Pausado — la wallet se bloqueó mientras el watcher estaba corriendo.",
        pausedServerRestart:
          "Pausado al arrancar — la wallet estaba bloqueada tras el reinicio del servidor.",
        pausedOther: (reason: string) => `Pausado (${reason}).`,
        stopped: "Detenido manualmente. Sin más ticks.",
        triggered: (kind: string) =>
          `Umbral de ${kind} cruzado — preparando el cierre.`,
        bufferArmedTp: (duration: string) =>
          `Take-profit cruzado. Esperando ${duration} de precio sostenido antes de cerrar.`,
        bufferArmedSl: (duration: string) =>
          `Stop-loss cruzado. Esperando ${duration} de precio sostenido antes de cerrar.`,
        bufferResetTp:
          "Take-profit ya no está cruzado — cronómetro del buffer reseteado a cero.",
        bufferResetSl:
          "Stop-loss ya no está cruzado — cronómetro del buffer reseteado a cero.",
        closedDry:
          "Posición cerrada en simulación — no se envió transacción.",
        closedReal: "Posición cerrada on-chain.",
        swapSkipped: (notes: string | null) =>
          notes ? `Swap de salida saltado — ${notes}` : "Swap de salida saltado.",
        swapDry: "Swap cotizado en simulación — no se envió transacción.",
        swapReal: "Ganancias swappeadas on-chain.",
        verifiedDeltas: (parts: string) => `Delta on-chain: ${parts}`,
        verifiedNoChanges:
          "On-chain consultado — sin cambios de balance detectados.",
        errorGeneric: "Error desconocido.",
      },
    },
  },

  tasksList: {
    pageEyebrow: "Histórico",
    pageTitle: "Histórico.",
    pageDescription:
      "Cierres y errores de auto-exits pasados. Los activos viven en el dashboard.",
    backLabel: "Inicio",
    noMatch: "Ningún auto-exit coincide con este filtro.",
    loadMore: "Cargar más",
    loadingMore: "Cargando…",
    emptyEyebrow: "Vacío",
    emptyTitle: "Aún no hay cierres ni errores.",
    emptyBody:
      "Cuando un auto-exit se cierre — porque el precio alcanzó el trigger, lo detuviste manualmente, o falló — aparecerá aquí. Las posiciones activas vigilándose viven en el dashboard.",
    emptyCta: "Ir al dashboard →",
    filters: {
      completed: "Completados",
      errors: "Errores",
    },
    cols: {
      status: "Estado",
      position: "Posición",
      trigger: "Trigger",
      closedAt: "Cerró por",
      result: "Resultado",
      when: "Cuándo",
    },
  },

  settings: {
    pageEyebrow: "Ajustes",
    pageTitle: "Defaults para este servidor.",
    pageDescription:
      "Los defaults de RPC, slippage y polling pre-rellenan el formulario de auto-exit. El form deja sobrescribirlos por auto-exit; esto es solo el punto de partida.",
    backLabel: "Inicio",

    updater: {
      eyebrow: "Actualizaciones",
      title: "Buscar versiones nuevas.",
      label: "Comprobar al arrancar",
      copy: "Si está activo, la app pregunta a GitHub si hay una versión nueva cada vez que arranca. Off por defecto — esa comprobación es una petición de red que sale de tu ordenador, así que es opt-in.",
      notTauriCopy:
        "El auto-update solo está disponible en la app desktop instalada. Estás ejecutando el servidor fuera de Tauri, así que las actualizaciones son manuales.",
      notTauriLink: "Cómo actualizar manualmente",
    },

    networkSection: {
      eyebrow: "Red & RPC",
      title: "Dónde lee la cadena este servidor.",
    },
    defaultsSection: {
      eyebrow: "Defaults de auto-exit",
      title: "Pre-rellenados al configurar uno.",
    },

    networkLabel: "Red",
    test: "TEST",
    real: "REAL",
    testCopy:
      "Modo test — los auto-exits corren en Solana devnet. Sin fondos reales en riesgo.",
    realCopy:
      "Modo real — los auto-exits firman en Solana mainnet con fondos reales.",
    realLocked: "El modo real está bloqueado en este servidor.",
    realLockedHow: "Cómo activarlo",
    realLockedDisabled: "Bloqueado — activar en el entorno del servidor",
    switchTestPrompt:
      "¿Volver a modo test? Los nuevos auto-exits correrán en Solana devnet.",

    confirmReal: {
      title: "Confirma el cambio a modo real",
      body: "Cada auto-exit que crees a partir de ahora firmará transacciones en Solana mainnet con fondos reales. Las transacciones de cierre cuestan SOL real; los movimientos de precio afectan dinero real. No hay deshacer en un cierre disparado.",
      bullet1Strong: "URL del RPC",
      bullet1Rest:
        " de abajo a un endpoint mainnet (Helius, QuickNode, Triton, o tu propio nodo). La URL pública de devnet no funciona.",
      bullet1Prefix: "Actualiza la ",
      bullet2:
        "Los auto-exits existentes mantienen su red original — no se auto-migran. Solo los nuevos serán en mainnet.",
      bullet3: "Re-testea tu estrategia en devnet antes de pulsar el switch.",
      understood:
        "Entiendo que esto firmará transacciones con fondos reales y he actualizado mi URL del RPC.",
      disclaimerLink: "→ Disclaimer · la herramienta se entrega sin garantía",
      cancel: "Cancelar",
      switching: "Cambiando…",
      confirmCta: "Confirmar · usar fondos reales",
    },

    rpc: {
      label: "URL del RPC",
      hint: "cualquier endpoint Solana JSON-RPC",
      mainnetWarning:
        "El endpoint público de mainnet-beta tiene rate-limits muy estrictos y no es fiable para un watcher. Usa Helius, QuickNode, Triton, o un nodo propio.",
      devnetWarning:
        "El endpoint público de devnet tiene rate-limits. Para uso sostenido cambia a Helius, QuickNode, Triton, o un nodo propio.",
      useDefault: (network: string) => `usar default ${network}`,
      testCta: "Probar conexión",
      testing: "Probando…",
      testOk: (version: string, latencyMs: number) =>
        `OK · ${version} · ${latencyMs} ms`,
      testFailPrefix: "Fallo al probar el RPC: ",
    },

    slippage: {
      label: "Slippage de cierre",
      legacyStored: (bps: number) =>
        `Valor guardado: ${bps} bps. Elige un preset para actualizarlo.`,
      copy05:
        "estricto; fiable solo en pairs de stablecoins profundas (USDC/USDT). Los triggers pueden no completarse en minutos volátiles.",
      copy1:
        "Funciona para la mayoría de pairs en volatilidad normal. Buen equilibrio entre protección y fiabilidad.",
      copy1Recommended: "default recomendado",
      copy2:
        "para pairs volátiles (low-cap, pools memecoin). El precio tiene que moverse mucho para que el cierre revierta.",
      copy5:
        "solo cuando el cierre",
      copy5Must: "tiene que",
      copy5Rest:
        " completarse. Acepta un peaje alto de price impact a cambio de riesgo de reversión casi cero.",
      docsLink: "Cómo afecta el slippage al cierre",
    },

    exitSlippage: {
      label: "Slippage del swap de salida",
      legacyStored: (bps: number) =>
        `Valor guardado: ${bps} bps. Elige un preset para actualizarlo.`,
      copyPart1:
        "Solo se usa cuando un auto-exit elige también un token de salida. Misma escala que arriba — misma recomendación: ",
      copyPart2: " para pairs habituales, ",
      copyPart3: " cuando el pool es poco profundo o volátil.",
    },

    poll: {
      label: "Intervalo de poll",
      legacyStored: (s: string) =>
        `Valor guardado: ${s}s. Elige un preset para actualizarlo — el default anterior de 5s era demasiado agresivo en la mayoría de RPCs.`,
      copy10: " · reacción más rápida. Solo merece la pena para triggers ",
      copy10Without: "sin",
      copy10Rest:
        " time buffer y en un RPC de pago (8.6k requests/día por auto-exit — quema el tier gratis de Helius en 12 días).",
      copy30: " · ",
      copy30Recommended: "default recomendado",
      copy30Rest:
        ". Capta todo movimiento relevante (los precios LP no saltan 5% en 20s) y cabe con holgura en el tier gratis de Helius con varios watchers corriendo.",
      copy1min:
        " · barato en RPC. Perfecto si usas time buffers — la espera del buffer de horas eclipsa la cadencia del polling.",
      copy5min:
        " · solo para buffers muy largos (días) o pools estables y lentos. Con triggers sin buffer puedes perder el cruce.",
      docsLink: "Intervalo de poll, coste RPC y buffers",
    },

    perTaskNote:
      "Los slippages de arriba se pueden sobrescribir por auto-exit en el formulario de configure. El intervalo de poll es global del servidor; el form no expone override por auto-exit. Cambiar un default aquí solo afecta a nuevos auto-exits.",

    lowBalance: {
      eyebrow: "Dashboard",
      title: "Umbral de balance bajo.",
      label: "Avisar cuando el saldo de SOL baje de",
      unit: "SOL",
      copy:
        "Solo afecta al callout del dashboard, no al watcher. Pon 0 para desactivar. Default 0.05 SOL cubre ~10 cierres + ATA creation.",
      invalid:
        "Introduce un número entre 0 y 5 SOL.",
    },

    resetPrompt:
      "¿Resetear URL del RPC, slippage e intervalo de poll a sus defaults?\n\nTu elección de red (TEST / REAL) se mantiene — cámbiala desde el toggle de arriba si lo necesitas.",
    resetCta: "Resetear a defaults",
  },

  wallet: {
    pageEyebrow: "Wallet",
    pageTitle: "La wallet del bot.",
    pageDescription:
      "La cuenta con la que el bot abre y cierra tus auto-exits. Vive cifrada en tu equipo y solo se desbloquea cuando tú la desbloqueas.",
    backLabel: "Inicio",
    encryptionLink: "Cómo funciona el cifrado y el almacenamiento de claves",
    loading: "Cargando estado de la wallet…",
    backendError: (msg: string) => `No se puede contactar con el backend: ${msg}`,

    scope: {
      eyebrow: "Alcance",
      body:
        "Sea cual sea la clave que des, solo esa única address queda expuesta a este servidor — nunca una seed phrase, nunca otras cuentas. La práctica habitual es usar una cuenta dedicada a operaciones activas, no aquella donde guardas holdings en frío.",
    },

    noVault: {
      eyebrow: "Sin wallet",
      title: "Configura la bot wallet para empezar.",
      body:
        "Genera un keypair nuevo en esta máquina, o importa la clave privada de una única cuenta de Solana desde Phantom, Backpack, o la Solana CLI. La clave se cifra con un passphrase y se usa solo para firmar los cierres que configures.",
      cta: "Configurar bot wallet →",
      docs: "Leer sobre los tres caminos",
    },

    locked: {
      eyebrow: "Wallet bloqueada",
      bodyWithAddress: (addr: string) =>
        `Un keypair está cifrado en disco para ${addr}. Introduce el passphrase para cargarlo en memoria.`,
      bodyNoAddress:
        "Un keypair está cifrado en disco. Introduce el passphrase para cargarlo en memoria.",
      passphraseLabel: "Passphrase",
      unlocking: "Desbloqueando…",
      unlock: "Desbloquear",
    },

    unlocked: {
      eyebrow: "Wallet desbloqueada",
      addressDisplay: {
        copy: "Copiar",
        copied: "Copiada",
        showFull: "Mostrar completa",
        showTruncated: "Mostrar truncada",
        viewOnExplorer: "Ver en Solscan",
      },
      balanceLabel: "Saldo",
      balanceLoading: "…",
      balanceUnavailable: "—",
      body:
        "El keypair está en memoria. Se usará para firmar las transacciones de cierre y swap de los auto-exits armados.",
      lockEyebrow: "Bloquear",
      lockTitle: "Bloquear la wallet",
      lockExplainP1:
        "Saca la key desencriptada de la memoria. El archivo cifrado se queda en disco — desbloquear te pide la passphrase de nuevo.",
      lockExplainP2:
        "Los auto-exits activos se pausan mientras esté bloqueada y se reanudan al desbloquear. Útil si vas a estar fuera bastante tiempo y prefieres que el bot deje de vigilar.",
      lockExplainTradeoff: "Notas de seguridad",
      lockButton: "Bloquear wallet",
      locking: "Bloqueando…",
      lockBlocked: "Cierre en vuelo…",
      lockBlockedTooltip:
        "Hay una transacción de cierre en vuelo. Espera a que termine antes de bloquear — bloquear ahora no la cancela, solo impide que el watcher registre el receipt.",
      lock: "Bloquear",
    },

    danger: {
      eyebrow: "Zona peligrosa",
      docsLink: "Qué hace realmente el borrado",
      explainReset:
        "Borra permanentemente el archivo de wallet cifrada. La wallet on-chain no se ve afectada — solo se elimina la copia cifrada de este servidor.",
      explainLostPass:
        "Si no recuerdas el passphrase, borrar el archivo cifrado es la única salida. La wallet on-chain sigue segura; solo pierdes la copia cifrada de este servidor.",
      confirmDelete: "¿Borrar el archivo de wallet cifrada?",
      cancel: "Cancelar",
      yesDelete: "Sí, borrar",
      deleteCta: "Borrar wallet",
    },
  },

  modal: {
    closeAria: "Cerrar",
    title: "Configurar bot wallet",
    intro:
      "Una cuenta cuya clave vive cifrada en esta máquina. El bot la usa para firmar cierres cuando los triggers se disparan — incluso cuando no estás presente.",
    notPhantom:
      "No es un \"connect wallet\" tipo Phantom. El bot no puede mostrar un popup de firma a las 3 de la mañana — necesita la clave en disco. Aquí tienes los tres caminos para ponerla:",
    disclaimerLink: "→ Disclaimer · uso bajo tu propia responsabilidad",
    tabs: {
      generate: "Generar",
      importKey: "Importar clave",
      advancedJson: "Avanzado · JSON",
    },
    generate: {
      title: "Generar un keypair nuevo",
      body:
        "Creamos un keypair ed25519 nuevo en esta máquina, lo ciframos con tu passphrase, y te enseñamos el secreto una vez para que lo guardes en tu password manager. Tras eso, en disco solo queda el archivo cifrado.",
      hint: "≥ 8 caracteres",
      passphraseLabel: "Passphrase",
      confirmLabel: "Confirmar",
      errorShort: "El passphrase debe tener al menos 8 caracteres.",
      errorMismatch: "Los passphrases no coinciden.",
      generating: "Generando…",
      submitCta: "Generar y cifrar",
      finePrint:
        "Recomendado si no tienes ya una cuenta operacional dedicada.",
    },
    importBase58: {
      title: "Importar una clave (base58)",
      body:
        "Pega la clave privada de una única cuenta de Solana en formato base58 — típicamente la que Phantom o Backpack exportan por cuenta (≈ 88 caracteres). No se aceptan seed phrases, así que solo esta única address llega a este servidor.",
    },
    importJson: {
      title: "Avanzado — array JSON de bytes",
      body:
        "Pega el contenido de wallet.json de Solana CLI — un array JSON de 64 enteros, p.ej. [12, 45, 200, …]. Mismo alcance que la pestaña Importar clave: representa una única cuenta.",
    },
    importCommon: {
      secretLabel: "Clave secreta",
      secretHintBase58: "≈ 88 caracteres base58",
      secretHintJson: "[12, 34, 56, …]  · 64 enteros",
      placeholderBase58: "3suF5rw3…",
      placeholderJson: "[12, 45, 200, …, 8]",
      passphraseLabel: "Passphrase",
      confirmLabel: "Confirmar",
      passphraseHint: "≥ 8 caracteres",
      errorShort: "El passphrase debe tener al menos 8 caracteres.",
      errorMismatch: "Los passphrases no coinciden.",
      importing: "Importando…",
      submitCta: "Cifrar y desbloquear",
    },
    importWarning: {
      eyebrow: "Alcance operacional",
      body:
        "La clave se guarda cifrada en disco en esta máquina y se descifra en memoria solo mientras la wallet está desbloqueada. Si tanto tu passphrase como el archivo cifrado de la wallet fueran comprometidos a la vez, los activos en esta única address podrían moverse por el atacante — nada más en tu wallet, ninguna otra cuenta, ninguna address derivada de seed.",
      body2:
        "La práctica habitual es importar una cuenta dedicada a operaciones activas (una cuenta \"caliente\" separada de las cold holdings), no la cuenta donde guardas todo.",
      readMore: "Leer el blast radius preciso",
    },
    success: {
      title: "Guarda tu secreto. Ahora.",
      bodyIntro:
        "Se ha generado una bot wallet nueva, cifrada con tu passphrase, y desbloqueada. Abajo tienes la clave secreta.",
      bodyStrong: "Es la única vez que la verás.",
      secretEyebrow: "Clave secreta · base58",
      reveal: "mostrar",
      hide: "ocultar",
      copy: "copiar",
      copied: "copiada",
      savedCheckbox:
        "He guardado la clave secreta en un sitio seguro (password manager, backup offline). Entiendo que no se mostrará de nuevo.",
      nextEyebrow: "Siguiente",
      step1Body:
        "Importa este secreto en Phantom o Backpack como cuenta nueva (Settings → Add wallet → Import private key). La bot wallet queda al lado de tu cuenta principal y puedes usarla desde ahí.",
      step2BodyPrefix: "Fondea ",
      step2BodySuffix:
        " con SOL (para fees) y los tokens que quieras que gestione.",
      step3Body:
        "Abre una posición LP en Orca con la cuenta del bot seleccionada en tu wallet. Aparecerá bajo Positions aquí para configurar un auto-exit.",
      alternative:
        "Alternativa: transfiere el NFT de una posición existente desde cualquier cuenta que controles a esta address.",
      continueCta: "Continuar",
    },
    address: {
      label: "Address",
      balance: "Balance",
      faucetCta: "Conseguir SOL de devnet del faucet",
      scanHint: "escanea para enviar fondos",
    },
  },
};
