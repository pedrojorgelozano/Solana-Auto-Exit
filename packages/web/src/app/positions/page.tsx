import { redirect } from "next/navigation";

/**
 * /positions ya no existe como página separada — el listado de posiciones
 * con auto-exit por row vive en el home. Redirigimos para que enlaces
 * históricos (back links, bookmarks, docs antiguas) no aterricen en 404.
 *
 * /positions/[mint] sigue activo para la pantalla de configure.
 */
export default function PositionsRedirect() {
  redirect("/");
}
