import Image from 'next/image';
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
    <span className={clases}>
      <Image
        src="/marca/logo-zav-transparente.svg"
        alt="ZAV · Fiambres y embutidos"
        loading="eager"
        fetchPriority={grande ? 'high' : undefined}
        width={1080}
        height={1080}
        sizes={grande ? '(max-width: 600px) 240px, 340px' : compacta ? '54px' : '96px'}
        unoptimized
      />
    </span>
  );
}
