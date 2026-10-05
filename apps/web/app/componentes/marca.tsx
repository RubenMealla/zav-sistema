import styles from './marca.module.css';

export function Marca({ grande=false, compacta=false, soloSimbolo=false, soloLettering=false }:{
  etiqueta?:boolean; grande?:boolean; compacta?:boolean; soloSimbolo?:boolean; soloLettering?:boolean;
}) {
  const clases=[styles.marca,grande?styles.grande:'',compacta?styles.compacta:'',soloSimbolo?styles.soloSimbolo:'',soloLettering?styles.soloLettering:''].filter(Boolean).join(' ');
  return <span className={clases} data-marca>
    {!soloLettering && <span className={styles.simbolo} data-simbolo aria-hidden="true"><svg viewBox="315 278 445 220" focusable="false"><use href="/marca/zav-oficial.svg#zav-cerdo-base"/><use href="/marca/zav-oficial.svg#zav-cerdo-color"/></svg></span>}
    {!soloSimbolo && <span className={styles.lettering} data-lettering><svg viewBox="120 552 850 270" role="img" aria-label="ZAV · Fiambres y Embutidos" focusable="false"><use href="/marca/zav-oficial.svg#zav-lettering"/></svg></span>}
  </span>;
}
