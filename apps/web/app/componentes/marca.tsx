import styles from './marca.module.css';

export function Marca({
  grande = false,
  compacta = false,
}: {
  etiqueta?: boolean;
  grande?: boolean;
  compacta?: boolean;
}) {
  const clases = [
    styles.marca,
    grande ? styles.grande : '',
    compacta ? styles.compacta : '',
  ].filter(Boolean).join(' ');

  return (
    <span className={clases} role="img" aria-label="ZAV · Fiambres y embutidos">
      <svg viewBox="0 0 1080 1080" aria-hidden="true" focusable="false">
        <defs>
          <filter id="zav-luminancia" x="-5%" y="-5%" width="110%" height="110%" colorInterpolationFilters="sRGB">
            <feColorMatrix type="luminanceToAlpha" />
            <feComponentTransfer>
              <feFuncA type="linear" slope="3" intercept="-0.28" />
            </feComponentTransfer>
          </filter>
          <mask id="zav-contenido" maskUnits="userSpaceOnUse" x="0" y="0" width="1080" height="1080" maskType="alpha">
            <image
              href="/marca/logo-zav.jpg"
              x="0"
              y="0"
              width="1080"
              height="1080"
              preserveAspectRatio="xMidYMid meet"
              filter="url(#zav-luminancia)"
            />
          </mask>
        </defs>
        <image
          href="/marca/logo-zav.jpg"
          x="0"
          y="0"
          width="1080"
          height="1080"
          preserveAspectRatio="xMidYMid meet"
          mask="url(#zav-contenido)"
        />
      </svg>
    </span>
  );
}
