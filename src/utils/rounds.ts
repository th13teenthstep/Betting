import type { Fixture } from '../types/football';

const HAS_ROUND = /\d/;

/**
 * Hafta (matchday) bilgisi olmayan maclara, takimlarin oynadigi mac sirasindan
 * turetilmis bir hafta numarasi verir ("Round N").
 *
 * Kural: bir macin haftasi = iki takimdan "kacinci macini oynadigi" buyuk olan.
 * (Eski kural olan "sayaclari esitle" yontemi ertelenen maclarda haftalari
 * sisiriyordu: La Liga 41 hafta cikiyordu. Bu kural 2026 sezonunun gercek hafta
 * numaralarina karsi %96 dogru, hafta sayilari dogru: 38/38/34/46.)
 * Kaynakta hafta bilgisi zaten olan maclara dokunulmaz.
 */
export function withDerivedRounds(fixtures: Fixture[]): Fixture[] {
  if (fixtures.every((f) => HAS_ROUND.test(f.league.round ?? ''))) return fixtures;

  const sorted = [...fixtures].sort(
    (a, b) => Date.parse(a.fixture.date) - Date.parse(b.fixture.date),
  );
  const played = new Map<number, number>(); // takim -> oynadigi mac sayisi
  const derived = new Map<number, number>();

  for (const f of sorted) {
    const home = f.teams.home.id;
    const away = f.teams.away.id;
    const homeNth = (played.get(home) ?? 0) + 1;
    const awayNth = (played.get(away) ?? 0) + 1;
    played.set(home, homeNth);
    played.set(away, awayNth);
    derived.set(f.fixture.id, Math.max(homeNth, awayNth));
  }

  return fixtures.map((f) =>
    HAS_ROUND.test(f.league.round ?? '')
      ? f
      : { ...f, league: { ...f.league, round: `Round ${derived.get(f.fixture.id)}` } },
  );
}
