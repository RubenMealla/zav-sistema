import Image from 'next/image';
import styles from './marca.module.css';

export function Marca({ grande = false, compacta = false }: { etiqueta?: boolean; grande?: boolean; compacta?: boolean }) {
  const clases = [styles.marca, grande ? styles.grande : '', compacta ? styles.compacta : ''].filter(Boolean).join(' ');
  return (
    <span className={clases}>
      <Image src="/marca/zav-transparente.svg" alt="ZAV · Fiambres y embutidos" width={1024} height={1024} priority={grande} sizes={grande ? '(max-width: 900px) 280px, 340px' : compacta ? '54px' : '96px'} />
    </span>
  );
}
