import aliasesJson from '../data/teamAliases.json';

/**
 * API (TheStatsAPI) ve dosya kaynakli veritabani (football-data) ayni takimi farkli
 * yazar ("Manchester United" / "Man United"). Bu yardimci, API adini DB'deki ada eslestirir.
 *
 * Sira: (1) acik takma ad tablosu, (2) normalize edilmis tam esitlik,
 * (3) tek adayli icerme ("Charlotte" ⊂ "Charlotte FC"). Belirsizse null doner.
 */

/**
 * normalize(API adi) -> normalize(DB adi). Elle dogrulanmis istisnalar.
 * "<ligId>:<anahtar>" bicimindeki girdi sadece o lig icin gecerlidir ve genel girdiye onceliklidir
 * (orn. Portekiz'in "Vitória SC"si ile Brezilya'nin "Vitória"si ayni anahtara duser).
 */
const ALIASES = aliasesJson as Record<string, string>;

const STOP = new Set(['fc', 'cf', 'sc', 'afc', 'ac', 'fk', 'sk']);

export function teamKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((t) => t && !STOP.has(t))
    .join('');
}

export function matchTeamName(apiName: string, dbNames: string[], leagueId?: number): string | null {
  const k = teamKey(apiName);
  const target = (leagueId != null ? ALIASES[`${leagueId}:${k}`] : undefined) ?? ALIASES[k] ?? k;
  const keyed = dbNames.map((n) => ({ n, k: teamKey(n) }));

  const exact = keyed.find((d) => d.k === target);
  if (exact) return exact.n;

  if (target.length >= 4) {
    const partial = keyed.filter((d) => d.k.length >= 4 && (d.k.includes(target) || target.includes(d.k)));
    if (partial.length === 1) return partial[0].n;
  }
  return null;
}
