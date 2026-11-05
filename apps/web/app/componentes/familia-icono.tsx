const iconosFamilia = {
  mortadelas: (
    <svg viewBox="0 0 64 48" aria-hidden="true">
      <rect x="7" y="11" width="42" height="26" rx="13" />
      <ellipse cx="49" cy="24" rx="9" ry="13" opacity=".78" />
      <circle className="familia-detalle" cx="46" cy="19" r="2.2" />
      <circle className="familia-detalle" cx="51" cy="26" r="1.8" />
      <circle className="familia-detalle" cx="45" cy="30" r="1.5" />
    </svg>
  ),
  chorizos: (
    <svg viewBox="0 0 64 48" aria-hidden="true">
      <rect
        x="7"
        y="8"
        width="15"
        height="31"
        rx="7.5"
        transform="rotate(-18 14.5 23.5)"
      />
      <rect
        x="24"
        y="7"
        width="15"
        height="32"
        rx="7.5"
        transform="rotate(8 31.5 23)"
      />
      <rect
        x="42"
        y="9"
        width="14"
        height="30"
        rx="7"
        transform="rotate(20 49 24)"
      />
      <path className="familia-detalle-trazo" d="M9 8 6 5m17 2 1-4m30 7 4-2" />
    </svg>
  ),
  salchichas: (
    <svg viewBox="0 0 64 48" aria-hidden="true">
      <rect x="7" y="10" width="49" height="11" rx="5.5" />
      <rect x="7" y="27" width="49" height="11" rx="5.5" />
      <path
        className="familia-detalle-trazo"
        d="M4 15h4m48 0h4M4 32h4m48 0h4"
      />
    </svg>
  ),
  morcillas: (
    <svg viewBox="0 0 64 48" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M13 7c10-7 28-4 35 7 7 12 1 27-12 30-12 3-25-3-28-14-2-7 0-16 5-23Zm8 9c-5 4-6 11-2 16 4 5 12 6 17 2 6-4 7-12 3-17-4-5-12-6-18-1Z"
      />
      <path className="familia-detalle-trazo" d="m12 8-5-3m42 8 6-2" />
    </svg>
  ),
  jamones: (
    <svg viewBox="0 0 64 48" aria-hidden="true">
      <path d="M13 10c8-7 24-8 34-1 9 7 9 20 2 28-8 9-24 10-34 3-9-7-10-21-2-30Z" />
      <circle className="familia-detalle" cx="22" cy="26" r="6" />
      <rect
        x="46"
        y="7"
        width="11"
        height="7"
        rx="3.5"
        transform="rotate(-36 51.5 10.5)"
      />
    </svg>
  ),
  tocinos: (
    <svg viewBox="0 0 64 48" aria-hidden="true">
      <path d="M7 10c9-6 14 5 24 0 10-5 15 5 26 0v29c-11 5-16-5-26 0-10 5-15-6-24 0V10Z" />
      <path
        className="familia-detalle-trazo"
        d="M9 18c8-5 14 5 23 0 9-5 15 4 23 0M9 28c8-5 14 5 23 0 9-5 15 4 23 0"
      />
    </svg>
  ),
  especiales: (
    <svg viewBox="0 0 64 48" aria-hidden="true">
      <ellipse cx="32" cy="24" rx="25" ry="18" />
      <circle className="familia-detalle" cx="22" cy="18" r="3" />
      <circle className="familia-detalle" cx="37" cy="15" r="2.3" />
      <circle className="familia-detalle" cx="43" cy="27" r="3.2" />
      <circle className="familia-detalle" cx="26" cy="31" r="2.4" />
    </svg>
  ),
};

export function FamiliaIcono({ nombre }: { nombre: string }) {
  const normal = nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const clave = Object.keys(iconosFamilia).find((k) => normal.startsWith(k)) as
    keyof typeof iconosFamilia | undefined;
  return (
    <span className="familia-dibujo">
      {iconosFamilia[clave ?? "especiales"]}
    </span>
  );
}
