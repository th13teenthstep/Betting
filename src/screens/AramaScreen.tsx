import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import {
  OUTCOME_KEYS,
  searchFinishedMatchesByOdds,
  type OddsCriterion,
  type OddsTriple,
  type OutcomeKey,
  type SimilarFilter,
} from '../db/analysisRepo';
import { rowToFixture, type MatchRow } from '../db/matchesRepo';
import MatchCard from '../components/MatchCard';
import SyncProgressBar from '../components/SyncProgressBar';
import { useSyncProgress } from '../hooks/useSyncProgress';
import {
  enrichAllLeagues,
  getLeaguesNeedingEnrichment,
  type LeagueGap,
} from '../services/fileLeagueEnrich';
import { describeApiError } from '../services/thestatsapi';
import leagueMetaJson from '../data/leagueMeta.json';

type MetaEntry = { name: string; country: string; logo: string; flag: string | null };
const LEAGUE_META = leagueMetaJson as unknown as Record<string, MetaEntry>;

type SearchMode = 'opening' | 'closing' | 'both';
const SEARCH_MODE_LABEL: Record<SearchMode, string> = {
  opening: 'Açılışa göre',
  closing: 'Kapanışa göre',
  both: 'Her ikisine göre',
};

type Scope = 'finished' | 'upcoming';
const SCOPE_LABEL: Record<Scope, string> = {
  finished: 'Oynanmış maçlar',
  upcoming: 'Yaklaşan maçlar',
};

const OUTCOME_LABEL: Record<OutcomeKey, string> = { home: '1', draw: 'X', away: '2' };
const TOLERANCE_OPTIONS: number[] = [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5];
const MAX_LIST = 60;

type TripleText = Record<OutcomeKey, string>;
const EMPTY_TRIPLE: TripleText = { home: '', draw: '', away: '' };

function parseOdd(s: string): number | null {
  const n = Number(s.replace(',', '.').trim());
  return Number.isFinite(n) && n > 1 ? n : null;
}

/** Acilis/kapanis icin 1-X-2 giris satiri. */
function OddsTripleInputs({
  values,
  onChange,
}: {
  values: TripleText;
  onChange: (k: OutcomeKey, text: string) => void;
}) {
  return (
    <View style={styles.tripleRow}>
      {OUTCOME_KEYS.map((k) => (
        <View key={k} style={styles.tripleCol}>
          <Text style={styles.tripleLabel}>{OUTCOME_LABEL[k]}</Text>
          <TextInput
            style={styles.tripleInput}
            value={values[k]}
            onChangeText={(t) => onChange(k, t)}
            placeholder="–"
            placeholderTextColor="#BBB"
            keyboardType="decimal-pad"
            maxLength={6}
          />
        </View>
      ))}
    </View>
  );
}

function MiniToleranceChips({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tolRow}>
      {TOLERANCE_OPTIONS.map((opt) => {
        const active = opt === value;
        return (
          <TouchableOpacity
            key={String(opt)}
            onPress={() => onChange(opt)}
            activeOpacity={0.7}
            style={[styles.tolChip, active && styles.tolChipActive]}
          >
            <Text style={[styles.tolChipText, active && styles.tolChipTextActive]}>
              ±{opt.toFixed(2)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

/**
 * Yeni "Arayis" sekmesi: kullanicinin elle girdigi acilis/kapanis (1/X/2) oranlarina gore
 * TUM lig/sezonlardaki bitmis maclar arasinda arama yapar. "Yaklasan maclar" secimi su an
 * icin kapali (ucretsiz API, yuzlerce maci tek tek sorgulamaya cok yavas) — ucretli API'ye
 * gecilince bu ekran degismeden sadece arka plandaki arama fonksiyonu eklenecek.
 */
export default function AramaScreen() {
  const [mode, setMode] = useState<SearchMode>('opening');
  const [scope, setScope] = useState<Scope>('finished');
  const [openText, setOpenText] = useState<TripleText>(EMPTY_TRIPLE);
  const [closeText, setCloseText] = useState<TripleText>(EMPTY_TRIPLE);
  const [openTol, setOpenTol] = useState(0.1);
  const [closeTol, setCloseTol] = useState(0.1);

  const [loading, setLoading] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [result, setResult] = useState<{ rows: MatchRow[]; total: number } | null>(null);

  // Eksik veri indirme: dosyada IY/orani eksik ligleri bulup tek butonla hepsini kuyruga ekler.
  const sync = useSyncProgress();
  const [gaps, setGaps] = useState<LeagueGap[] | null>(null);
  const [gapsLoading, setGapsLoading] = useState(false);
  const [gapsErr, setGapsErr] = useState<string | null>(null);
  const [enrichStatus, setEnrichStatus] = useState<string | null>(null);
  const [enriching, setEnriching] = useState(false);

  const kontrolEt = async () => {
    setGapsLoading(true);
    setGapsErr(null);
    setEnrichStatus(null);
    try {
      setGaps(await getLeaguesNeedingEnrichment());
    } catch (e) {
      setGapsErr(describeApiError(e));
    } finally {
      setGapsLoading(false);
    }
  };

  const tumunuIndir = async () => {
    if (!gaps || gaps.length === 0 || enriching) return;
    setGapsErr(null);
    setEnriching(true);
    try {
      await enrichAllLeagues(gaps, (done, total, current) => {
        setEnrichStatus(`${current.country} – ${current.name} kuyruğa ekleniyor… (${done + 1}/${total})`);
      });
      setEnrichStatus('Hepsi kuyruğa eklendi, arka planda indiriliyor.');
      setGaps(await getLeaguesNeedingEnrichment());
    } catch (e) {
      setGapsErr(describeApiError(e));
    } finally {
      setEnriching(false);
    }
  };

  const openActive = mode === 'opening' || mode === 'both';
  const closeActive = mode === 'closing' || mode === 'both';

  const openTriple: OddsTriple = useMemo(
    () => ({ home: parseOdd(openText.home), draw: parseOdd(openText.draw), away: parseOdd(openText.away) }),
    [openText],
  );
  const closeTriple: OddsTriple = useMemo(
    () => ({ home: parseOdd(closeText.home), draw: parseOdd(closeText.draw), away: parseOdd(closeText.away) }),
    [closeText],
  );

  const hasAnyInput =
    (openActive && OUTCOME_KEYS.some((k) => openTriple[k] != null)) ||
    (closeActive && OUTCOME_KEYS.some((k) => closeTriple[k] != null));

  const ara = async () => {
    if (scope === 'upcoming') return;
    if (!hasAnyInput) {
      setHata('Aramak için en az bir oran girin.');
      setResult(null);
      return;
    }
    setHata(null);
    setLoading(true);
    try {
      const OFF: OddsCriterion = { target: { home: null, draw: null, away: null }, tolerance: null };
      const filter: SimilarFilter = {
        opening: openActive ? { target: openTriple, tolerance: openTol } : OFF,
        closing: closeActive ? { target: closeTriple, tolerance: closeTol } : OFF,
      };
      setResult(await searchFinishedMatchesByOdds(filter, MAX_LIST));
    } catch (e) {
      setHata(e instanceof Error ? e.message : String(e));
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <SyncProgressBar state={sync} />
      <View style={styles.header}>
        <Text style={styles.title}>🔎 Arayış</Text>
        <Text style={styles.subtitle}>Girdiğin oranlara yakın maçları tüm lig ve sezonlarda ara</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Eksik veri</Text>
        <Text style={styles.noteGrey}>
          Bazı liglerde (Arjantin, Brezilya, Çin, MLS gibi) devre arası skoru ve oranlar dosyada
          yok — API'den tek tek çekilmesi gerekiyor. Her ligi tek tek açıp beklemek yerine, hepsini
          tek seferde arka plana kuyruğa ekleyebilirsin.
        </Text>

        <TouchableOpacity
          disabled={gapsLoading}
          onPress={kontrolEt}
          activeOpacity={0.8}
          style={[styles.secondaryBtn, gapsLoading && styles.searchBtnDisabled]}
        >
          {gapsLoading ? (
            <ActivityIndicator color="#1A73E8" />
          ) : (
            <Text style={styles.secondaryBtnText}>Eksik ligleri göster</Text>
          )}
        </TouchableOpacity>
        {gapsErr && <Text style={styles.noteRed}>{gapsErr}</Text>}

        {gaps && gaps.length === 0 && !gapsErr && (
          <Text style={styles.noteGrey}>Eksik veri bulunamadı, her şey güncel.</Text>
        )}
        {gaps && gaps.length > 0 && (
          <>
            {gaps.map((g) => (
              <View key={g.leagueId} style={styles.gapRow}>
                <Text style={styles.gapName} numberOfLines={1}>
                  {g.country} – {g.name}
                </Text>
                <Text style={styles.gapCount}>{g.pending} maç</Text>
              </View>
            ))}
            <TouchableOpacity
              disabled={enriching}
              onPress={tumunuIndir}
              activeOpacity={0.8}
              style={[styles.searchBtn, enriching && styles.searchBtnDisabled]}
            >
              {enriching ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.searchBtnText}>
                  Tümünü indir ({gaps.reduce((s, g) => s + g.pending, 0)} maç)
                </Text>
              )}
            </TouchableOpacity>
            <Text style={styles.noteGrey}>
              Birkaç saat sürebilir — uygulama arka planda çalıştığı sürece devam eder.
            </Text>
          </>
        )}
        {enrichStatus && <Text style={styles.noteGrey}>{enrichStatus}</Text>}
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Hangi maçlar arasında ara?</Text>
        <View style={styles.modeRow}>
          {(['finished', 'upcoming'] as Scope[]).map((s) => (
            <TouchableOpacity
              key={s}
              onPress={() => setScope(s)}
              activeOpacity={0.7}
              style={[styles.modeOptBtn, scope === s && styles.modeOptBtnActive]}
            >
              <Text style={[styles.modeOptText, scope === s && styles.modeOptTextActive]}>
                {SCOPE_LABEL[s]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {scope === 'upcoming' && (
          <Text style={styles.noteGrey}>
            Bu özellik şu an için kullanılamıyor: şu anki (ücretsiz) API, önümüzdeki yüzlerce
            maçın oranını tek tek sorgulamak için çok yavaş. Ücretli API'ye geçince açılacak.
          </Text>
        )}

        <Text style={[styles.label, { marginTop: 14 }]}>Hangi orana göre ara?</Text>
        <View style={styles.modeRow}>
          {(['opening', 'closing', 'both'] as SearchMode[]).map((m) => (
            <TouchableOpacity
              key={m}
              onPress={() => setMode(m)}
              activeOpacity={0.7}
              style={[styles.modeOptBtn, mode === m && styles.modeOptBtnActive]}
            >
              <Text style={[styles.modeOptText, mode === m && styles.modeOptTextActive]}>
                {SEARCH_MODE_LABEL[m]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {openActive && (
          <View style={styles.tripleBlock}>
            <Text style={styles.label}>Açılış oranı</Text>
            <OddsTripleInputs
              values={openText}
              onChange={(k, t) => setOpenText((prev) => ({ ...prev, [k]: t }))}
            />
            <MiniToleranceChips value={openTol} onChange={setOpenTol} />
          </View>
        )}
        {closeActive && (
          <View style={styles.tripleBlock}>
            <Text style={styles.label}>Kapanış oranı</Text>
            <OddsTripleInputs
              values={closeText}
              onChange={(k, t) => setCloseText((prev) => ({ ...prev, [k]: t }))}
            />
            <MiniToleranceChips value={closeTol} onChange={setCloseTol} />
          </View>
        )}

        <TouchableOpacity
          disabled={scope === 'upcoming' || loading}
          onPress={ara}
          activeOpacity={0.8}
          style={[styles.searchBtn, (scope === 'upcoming' || loading) && styles.searchBtnDisabled]}
        >
          {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.searchBtnText}>Ara</Text>}
        </TouchableOpacity>
        {hata && <Text style={styles.noteRed}>{hata}</Text>}
      </View>

      {result && (
        <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {result.total} maç bulundu
              {result.total > result.rows.length ? (
                <Text style={styles.cardTitleLight}>{`  (ilk ${result.rows.length} gösteriliyor)`}</Text>
              ) : null}
            </Text>
          </View>
          {result.rows.map((r) => {
            const meta = LEAGUE_META[String(r.league_id)] ?? { name: '', country: '', logo: '', flag: null };
            return (
              <MatchCard
                key={r.id}
                fixture={rowToFixture(r, meta)}
                leagueId={r.league_id}
                season={r.season}
              />
            );
          })}
        </>
      )}
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F6FA' },
  content: { padding: 8, paddingBottom: 40 },
  header: { paddingHorizontal: 4, paddingVertical: 8 },
  title: { fontSize: 20, fontWeight: '800', color: '#1A1A1A' },
  subtitle: { fontSize: 12, color: '#777', marginTop: 2 },
  card: { backgroundColor: '#FFF', borderRadius: 12, padding: 12, marginBottom: 8 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: '#1A1A1A' },
  cardTitleLight: { fontSize: 12, fontWeight: '500', color: '#888' },
  label: { fontSize: 12, fontWeight: '700', color: '#555' },
  secondaryBtn: {
    marginTop: 10,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#E8EEF9',
  },
  secondaryBtnText: { color: '#1A73E8', fontWeight: '800', fontSize: 13 },
  gapRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EEE',
  },
  gapName: { flex: 1, fontSize: 13, fontWeight: '600', color: '#1A1A1A', marginRight: 8 },
  gapCount: { fontSize: 12, fontWeight: '700', color: '#888' },
  modeRow: { flexDirection: 'row', gap: 6, marginTop: 6 },
  modeOptBtn: {
    flex: 1,
    backgroundColor: '#F0F0F0',
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
  modeOptBtnActive: { backgroundColor: '#1A73E8' },
  modeOptText: { fontSize: 12, fontWeight: '700', color: '#555' },
  modeOptTextActive: { color: '#FFF' },
  noteGrey: { fontSize: 12, color: '#888', marginTop: 8, lineHeight: 17 },
  noteRed: { fontSize: 12, color: '#C62828', marginTop: 8 },
  tripleBlock: { marginTop: 14 },
  tripleRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  tripleCol: { flex: 1, alignItems: 'center' },
  tripleLabel: { fontSize: 11, fontWeight: '800', color: '#1A73E8', marginBottom: 4 },
  tripleInput: {
    width: '100%',
    height: 40,
    borderRadius: 8,
    backgroundColor: '#F0F0F0',
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
    color: '#111',
  },
  tolRow: { gap: 6, paddingTop: 8, paddingRight: 8 },
  tolChip: {
    height: 28,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tolChipActive: { backgroundColor: '#1A73E8' },
  tolChipText: { fontSize: 11, fontWeight: '600', color: '#555' },
  tolChipTextActive: { color: '#FFF' },
  searchBtn: {
    marginTop: 16,
    backgroundColor: '#1A73E8',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  searchBtnDisabled: { backgroundColor: '#A9BEDB' },
  searchBtnText: { color: '#FFF', fontWeight: '800', fontSize: 14 },
});
