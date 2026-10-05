import Image from 'next/image';
import styles from './marca.module.css';

export function Marca({ grande = false, compacta = false }: { etiqueta?: boolean; grande?: boolean; compacta?: boolean }) {
  const clases = [styles.marca, grande ? styles.grande : '', compacta ? styles.compacta : ''].filter(Boolean).join(' ');
  return (
    <span className={clases}>
      <Image
        src="/marca/zav-oficial.svg"
        alt="ZAV · Fiambres y embutidos"
        width={820}
        height={590}
        priority={grande}
        sizes={grande ? '(max-width: 900px) 320px, 420px' : compacta ? '116px' : '160px'}
      />
    </span>
  );
}
