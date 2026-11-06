import type { Fixture, Standing, StandingStats } from '../types/football';

/**
 * Fixtures (mac) listesinden puan durumu hesaplar.
 *
 * API-Football ucretsiz plani sadece 2022-2024 sezonlarinda standings endpoint'ine
 * izin veriyor. Diger sezonlar icin fixtures verisinden puan tablosunu biz cikariyoruz.
 *
 * Her mac icin:
 *   - Galibiyet = 3 puan, Beraberlik = 1 puan, Maglubiyet = 0 puan
 *   - Averaj = atilan gol - yenilen gol
 */

interface TakimIstatistik {
  takimId: number;
  takimAdi: string;
  takimLogo: string;
  oynanan: number;
  galibiyet: number;
  beraberlik: number;
  maglubiyet: number;
  atilanGol: number;
  yenilenGol: number;
  puan: number;
}

export function maclardanPuanDurumuHesapla(
  fixtures: Fixture[],
): Standing[] {
  const takimMap = new Map<number, TakimIstatistik>();

  for (const mac of fixtures) {
    const { teams, goals } = mac;

    // Sadece skoru belli olan maclari hesaba kat
    if (goals.home === null || goals.away === null) continue;

    // Ev sahibi
    kaydetVeyaGuncelle(takimMap, teams.home, goals.home, goals.away);
    // Deplasman
    kaydetVeyaGuncelle(takimMap, teams.away, goals.away, goals.home);
  }

  // Puana göre sırala (yüksekten düşüğe), eşitlikte averaja bak
  const sirali = Array.from(takimMap.values()).sort((a, b) => {
    if (b.puan !== a.puan) return b.puan - a.puan;
    const avA = a.atilanGol - a.yenilenGol;
    const avB = b.atilanGol - b.yenilenGol;
    if (avB !== avA) return avB - avA;
    return b.atilanGol - a.atilanGol;
  });

  return sirali.map((t, i): Standing => {
    const averaj = t.atilanGol - t.yenilenGol;

    const istatistik: StandingStats = {
      played: t.oynanan,
      win: t.galibiyet,
      draw: t.beraberlik,
      lose: t.maglubiyet,
      goals: {
        for: t.atilanGol,
        against: t.yenilenGol,
      },
    };

    return {
      rank: i + 1,
      team: {
        id: t.takimId,
        name: t.takimAdi,
        logo: t.takimLogo,
      },
      points: t.puan,
      goalsDiff: averaj,
      group: null,
      form: null,
      description: null,
      all: istatistik,
      home: { ...istatistik }, // fixtures'tan ev/deplasman ayrimi yok, hepsi ayni
      away: { ...istatistik },
    };
  });
}

function kaydetVeyaGuncelle(
  map: Map<number, TakimIstatistik>,
  takim: { id: number; name: string; logo: string },
  attigiGol: number,
    yedigiGol: number,
) {
  const mevcut = map.get(takim.id);
  if (!mevcut) {
    map.set(takim.id, {
      takimId: takim.id,
      takimAdi: takim.name,
      takimLogo: takim.logo,
      oynanan: 1,
      galibiyet: attigiGol > yedigiGol ? 1 : 0,
      beraberlik: attigiGol === yedigiGol ? 1 : 0,
      maglubiyet: attigiGol < yedigiGol ? 1 : 0,
      atilanGol: attigiGol,
      yenilenGol: yedigiGol,
      puan: attigiGol > yedigiGol ? 3 : attigiGol === yedigiGol ? 1 : 0,
    });
    return;
  }

  mevcut.oynanan += 1;
  mevcut.atilanGol += attigiGol;
  mevcut.yenilenGol += yedigiGol;

  if (attigiGol > yedigiGol) {
    mevcut.galibiyet += 1;
    mevcut.puan += 3;
  } else if (attigiGol === yedigiGol) {
    mevcut.beraberlik += 1;
    mevcut.puan += 1;
  } else {
    mevcut.maglubiyet += 1;
  }
}