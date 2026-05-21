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
    testMode: "modo test",
    testModeTooltip: "Modo test (Solana devnet) — pulsa para volver a real",
    onOrcaMeteora: "en Orca · Meteora",
    languageToggle: "Idioma",
  },

  vaultChip: {
    wallet: "wallet",
    setupWallet: "configurar wallet",
    walletLocked: "wallet bloqueada",
    walletUnlocked: "wallet desbloqueada",
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
    sim: "· sim",
    simulation: "· simulación",
  },

  home: {
    firstRun: {
      eyebrow: "auto-exits para pools de liquidez en Solana",
      titleLine1: "Pon las condiciones.",
      titleLine2: "Despreocúpate.",
      intro:
        "Auto-Exit vigila tus posiciones de liquidez en Orca (y pronto Meteora) cada pocos segundos y las cierra cuando el precio alcanza tu take-profit o stop-loss. Corre en esta máquina y firma con una wallet que tú controlas.",
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
      ctaReadGuide: "Lee la guía completa →",
      stepHint: "Paso 1 de 3 · puedes parar y reanudar en cualquier momento.",
      localEyebrow: "Stack local",
      localBody:
        "El servidor solo escucha en localhost. La clave de tu wallet vive cifrada en disco con tu passphrase y solo se descifra en memoria mientras está desbloqueada — nada sobre tu wallet, posiciones o trades sale de esta máquina.",
    },

    eyebrow: {
      botWallet: "Bot wallet",
      locked: "· bloqueada",
      onePosition: "1 posición",
      manyPositions: (n: number) => `${n} posiciones`,
      loadingPositions: "cargando posiciones…",
      oneWatching: "1 auto-exit vigilando",
      manyWatching: (n: number) => `${n} auto-exits vigilando`,
      whatIs: "→ Qué es una bot wallet",
    },

    hub: {
      headerStatus: "Estado",
      headerPosition: "Posición",
      headerAutoExit: "Auto-exit",
      headerAction: "Acción",
      loading: "Consultando la cadena para posiciones de esta wallet…",
      oneProtocolFailed: (msg: string) => `Una query de protocolo falló: ${msg}`,
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
      openOrca: "abrir orca ↗",
      openMeteora: "abrir meteora ↗",
      stepByStep: "→ Guía paso a paso",
    },

    activity: {
      eyebrow: "Histórico de transacciones",
      title: "Cierres, swaps y fallos.",
      viewAll: "Ver todos →",
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
        "Un auto-exit por posición. Ábrelo para ver su estado en vivo, pausarlo o detenerlo. Si quieres distintos ajustes, borra el actual y crea uno nuevo.",
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
      section2Docs: "→ docs",
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
    backLabel: "Todos los auto-exits",

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
        " para pools volátiles o poco profundos). Las tasks vivas son inmutables por diseño (ADR-013), así que editar no es posible.",
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
          "Pausado — la vault se bloqueó mientras el watcher estaba corriendo.",
        pausedServerRestart:
          "Pausado al arrancar — la vault estaba bloqueada tras el reinicio del servidor.",
        pausedOther: (reason: string) => `Pausado (${reason}).`,
        stopped: "Detenido manualmente. Sin más ticks.",
        triggered: (kind: string) =>
          `${kind} threshold cruzado — preparando el cierre.`,
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
};
