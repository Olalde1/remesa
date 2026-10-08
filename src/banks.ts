/**
 * SPEI participant catalog.
 *
 * SNAPSHOT: taken on 2026-10-08 from Banco de México's public list of SPEI
 * participants, as published for the public CEP (Comprobante Electrónico de
 * Pago) portal: https://www.banxico.org.mx/cep/ (institutions list for that date).
 * Names are kept exactly as Banco de México publishes them.
 *
 * The list changes over time (new participants, mergers, renames). Treat it as
 * a convenience snapshot, not as an authoritative real-time source. To refresh
 * it, compare against the institutions offered by the public CEP portal for the
 * current date, update RAW and BANK_CATALOG_SNAPSHOT_DATE, and note it in the
 * CHANGELOG.
 *
 * The 3-digit CLABE bank code is the last three digits of the 5-digit SPEI
 * participant code (e.g. 40012 -> 012), per Banco de México's CLABE standard.
 */

export interface Bank {
  /** SPEI participant code as published by Banco de México (5 digits, e.g. "40012"; Banco de México itself is "2001"). */
  readonly speiCode: string;
  /** 3-digit bank code used as the CLABE prefix, e.g. "012". */
  readonly clabeCode: string;
  /** Short name as published by Banco de México, e.g. "BBVA MEXICO". */
  readonly name: string;
}

/** ISO date (YYYY-MM-DD) of the catalog snapshot. */
export const BANK_CATALOG_SNAPSHOT_DATE = "2026-10-08";

/** Public source of the catalog snapshot. */
export const BANK_CATALOG_SOURCE = "https://www.banxico.org.mx/cep/";

const RAW: ReadonlyArray<readonly [speiCode: string, name: string]> = [
  ["2001", "BANXICO"],
  ["37006", "BANCOMEXT"],
  ["37009", "BANOBRAS"],
  ["37019", "BANJERCITO"],
  ["37135", "NAFIN"],
  ["37166", "BaBien"],
  ["37168", "HIPOTECARIA FED"],
  ["40002", "BANAMEX"],
  ["40012", "BBVA MEXICO"],
  ["40014", "SANTANDER"],
  ["40021", "HSBC"],
  ["40030", "BAJIO"],
  ["40036", "INBURSA"],
  ["40042", "MIFEL"],
  ["40044", "SCOTIABANK"],
  ["40058", "BANREGIO"],
  ["40059", "INVEX"],
  ["40060", "BANSI"],
  ["40062", "AFIRME"],
  ["40072", "BANORTE"],
  ["40106", "BANK OF AMERICA"],
  ["40108", "MUFG"],
  ["40110", "JP MORGAN"],
  ["40112", "BMONEX"],
  ["40113", "VE POR MAS"],
  ["40124", "CITI MEXICO"],
  ["40127", "AZTECA"],
  ["40128", "KAPITAL"],
  ["40129", "BARCLAYS"],
  ["40130", "COMPARTAMOS"],
  ["40132", "MULTIVA BANCO"],
  ["40133", "ACTINVER"],
  ["40136", "INTERCAM BANCO"],
  ["40137", "BANCOPPEL"],
  ["40138", "UALA"],
  ["40140", "CONSUBANCO"],
  ["40141", "VOLKSWAGEN"],
  ["40145", "BBASE"],
  ["40147", "BANKAOOL"],
  ["40148", "PAGATODO"],
  ["40150", "INMOBILIARIO"],
  ["40151", "DONDE"],
  ["40152", "BANCREA"],
  ["40154", "BANCO COVALTO"],
  ["40155", "ICBC"],
  ["40156", "SABADELL"],
  ["40157", "SHINHAN"],
  ["40158", "MIZUHO BANK"],
  ["40159", "BANK OF CHINA"],
  ["40160", "BANCO S3"],
  ["40167", "HEY BANCO"],
  ["40170", "REVOLUT BANK"],
  ["40638", "NUBANK"],
  ["90600", "MONEXCB"],
  ["90601", "GBM"],
  ["90602", "MASARI"],
  ["90605", "VALUE"],
  ["90616", "FINAMEX"],
  ["90617", "VALMEX"],
  ["90620", "PROFUTURO"],
  ["90631", "TRF"],
  ["90634", "FINCOMUN"],
  ["90646", "STP"],
  ["90652", "CREDICAPITAL"],
  ["90653", "KUSPIT"],
  ["90656", "UNAGRA"],
  ["90659", "ASP INTEGRA OPC"],
  ["90660", "Altor"],
  ["90661", "KLAR"],
  ["90670", "LIBERTAD"],
  ["90677", "CAJA POP MEXICA"],
  ["90680", "CRISTOBAL COLON"],
  ["90683", "CAJA TELEFONIST"],
  ["90684", "TRANSFER"],
  ["90685", "FONDO (FIRA)"],
  ["90688", "CREDICLUB"],
  ["90699", "FONDEADORA"],
  ["90703", "TESORED"],
  ["90706", "ARCUS FI"],
  ["90710", "NVIO"],
  ["90714", "PPBALANCEMX"],
  ["90715", "CASHI CUENTA"],
  ["90720", "MexPago"],
  ["90721", "albo"],
  ["90722", "Mercado Pago W"],
  ["90723", "Cuenca"],
  ["90725", "COOPDESARROLLO"],
  ["90727", "TRANSFER DIRECT"],
  ["90728", "SPIN BY OXXO"],
  ["90729", "Dep y Pag Dig"],
  ["90730", "Clip"],
  ["90732", "Peibo"],
  ["90734", "FINCO PAY"],
  ["90738", "FINTOC"],
  ["90901", "CLS"],
  ["90902", "INDEVAL"],
  ["90903", "CoDi Valida"],
];

/** All SPEI participants in the snapshot, sorted by SPEI code. */
export const banks: readonly Bank[] = Object.freeze(
  RAW.map(([speiCode, name]) => Object.freeze({ speiCode, clabeCode: speiCode.slice(-3), name })),
);

const byClabeCode = new Map<string, Bank>(banks.map((b) => [b.clabeCode, b]));
const bySpeiCode = new Map<string, Bank>(banks.map((b) => [b.speiCode, b]));

/**
 * Finds a bank by its 3-digit CLABE code ("012") or its SPEI
 * participant code ("40012"). Returns `undefined` when not in the snapshot.
 */
export function findBankByCode(code: string): Bank | undefined {
  const c = code.trim();
  if (/^\d{3}$/.test(c)) return byClabeCode.get(c);
  if (/^\d{4,5}$/.test(c)) return bySpeiCode.get(c);
  return undefined;
}

/** Finds the bank for a CLABE (or any string starting with the 3-digit bank code). */
export function findBankByClabe(clabe: string): Bank | undefined {
  const digits = clabe.replace(/[\s-]/g, "");
  if (!/^\d{3}/.test(digits)) return undefined;
  return byClabeCode.get(digits.slice(0, 3));
}
