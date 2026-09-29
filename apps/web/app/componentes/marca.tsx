import Image from 'next/image';
import styles from './marca.module.css';

/** Material de referencia de ZAV; sustituible por el original vectorial validado. */
export function Marca({ etiqueta = false, grande = false }: { etiqueta?: boolean; grande?: boolean }) {
  return (
    <span className={`${styles.marca} ${grande ? styles.grande : ''}`}>
      <Image
        src={etiqueta ? '/marca/etiqueta-zav.png' : '/marca/logo-zav.jpg'}
        alt="ZAV · Fiambres y embutidos"
        loading="eager"
        fetchPriority={grande ? 'high' : undefined}
        width={etiqueta ? 1254 : 1080}
        height={etiqueta ? 1254 : 1080}
        sizes={grande ? '(max-width: 600px) 280px, 440px' : '144px'}
      />
    </span>
  );
}
