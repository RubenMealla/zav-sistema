import Image from 'next/image';
import styles from './marca.module.css';

export function Marca({
  etiqueta = false,
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
    <span className={clases}>
      <Image
        src={etiqueta ? '/marca/etiqueta-zav.png' : '/marca/logo-zav.jpg'}
        alt="ZAV · Fiambres y embutidos"
        loading="eager"
        fetchPriority={grande ? 'high' : undefined}
        width={etiqueta ? 1254 : 1080}
        height={etiqueta ? 1254 : 1080}
        sizes={grande ? '(max-width: 600px) 260px, 360px' : compacta ? '56px' : '120px'}
      />
    </span>
  );
}
