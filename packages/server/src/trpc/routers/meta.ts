import fs from "node:fs";
import { router, publicProcedure } from "../init.js";
import { DB_PATH } from "../../db/client.js";

/**
 * Endpoints "sobre el server", no sobre el dominio. Health checks,
 * stats de la DB, etc. Si crece, romper en módulos.
 */
export const metaRouter = router({
  /**
   * Tamaño actual del archivo SQLite en bytes. El dashboard lo compara
   * contra un threshold (~50MB) para detectar un futuro bug que llene
   * la DB sin querer — uso normal son <2MB/año, así que un salto a
   * 50MB es señal clara de que algo va mal (un `appendHistory` en el
   * polling loop, etc.).
   *
   * statSync es sincronoide y baratísimo (es un syscall). No vale la
   * pena cachear: el dashboard refetcha cada minuto, eso es 1440
   * llamadas/día contra el FS, despreciable.
   */
  dbSize: publicProcedure.query(() => {
    try {
      const stat = fs.statSync(DB_PATH);
      return { bytes: stat.size };
    } catch {
      // DB todavía no creada / borrada → 0. No es un error; el dashboard
      // no debe alarmar antes de que el server escriba la primera vez.
      return { bytes: 0 };
    }
  }),
});
