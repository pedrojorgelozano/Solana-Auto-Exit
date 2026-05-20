"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

interface ConnectWalletCtx {
  open: () => void;
  close: () => void;
  isOpen: boolean;
}

const Ctx = createContext<ConnectWalletCtx | null>(null);

/**
 * Provider que controla la visibilidad del modal "Connect bot wallet".
 * Cualquier botón (VaultChip, Home Hero, /wallet CTA) puede invocar open()
 * vía useConnectWallet(). El modal real lo monta layout via dynamic mount.
 */
export function ConnectWalletProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const value = useMemo<ConnectWalletCtx>(
    () => ({
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
      isOpen,
    }),
    [isOpen],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useConnectWallet(): ConnectWalletCtx {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error("useConnectWallet must be used inside <ConnectWalletProvider>");
  }
  return ctx;
}
