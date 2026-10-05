import Image from 'next/image';
import styles from './marca.module.css';

export function Marca({ grande=false, compacta=false, soloSimbolo=false, soloLettering=false }:{
  etiqueta?:boolean; grande?:boolean; compacta?:boolean; soloSimbolo?:boolean; soloLettering?:boolean;
}) {
  const clases=[styles.marca,grande?styles.grande:'',compacta?styles.compacta:'',soloSimbolo?styles.soloSimbolo:'',soloLettering?styles.soloLettering:''].filter(Boolean).join(' ');
  return <span className={clases}>
    {!soloLettering && <span className={styles.simbolo}><Image src="/marca/zav-oficial.svg" alt="" width={820} height={590} priority={grande}/></span>}
    {!soloSimbolo && <span className={styles.lettering}><Image src="/marca/zav-oficial.svg" alt="ZAV · Fiambres y Embutidos" width={820} height={590} priority={grande}/></span>}
  </span>;
}
