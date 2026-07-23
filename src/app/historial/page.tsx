'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import { collection, getDocs, Timestamp } from 'firebase/firestore';
import { CalendarDays, ChevronLeft, CircleX, Loader2, RefreshCw, Trophy } from 'lucide-react';
import { AppNavigation } from '@/components/app-navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { db, isFirebaseConfigured } from '@/lib/firebase';
import type { PlayerStats, SavedMatch } from '@/lib/match-types';

type MatchRecord = SavedMatch & {
  id: string;
  createdAt?: Timestamp;
};

type Locale = 'es' | 'en';

const historyTranslations = {
  es: {
    title: 'Historial', subtitle: 'Partidos guardados', loading: 'Cargando partidos…', retry: 'Reintentar',
    noMatches: 'Todavía no hay partidos guardados', noMatchesDescription: 'Al terminar un partido aparecerá aquí.',
    firebaseError: 'Firebase no está configurado en esta instalación.', loadError: 'No se han podido cargar los partidos. Comprueba la conexión e inténtalo de nuevo.',
    teamAWon: 'Equipo A ganó', teamALost: 'Equipo A perdió', draw: 'Empate', opponents: 'Rivales', details: 'Detalle del partido', back: 'Volver al historial',
    sets: 'Sets', formatBestOfThree: 'Al mejor de 3 sets', goldenPoint: 'Punto de oro', advantage: 'Ventaja', statisticsBySet: 'Estadísticas por set',
    player: 'Jugador', totalSet: 'Total del set', totalMatch: 'Totales del partido', dateUnavailable: 'Fecha no disponible', refresh: 'Actualizar historial',
  },
  en: {
    title: 'History', subtitle: 'Saved matches', loading: 'Loading matches…', retry: 'Retry',
    noMatches: 'No saved matches yet', noMatchesDescription: 'Finished matches will appear here.',
    firebaseError: 'Firebase is not configured in this installation.', loadError: 'Could not load matches. Check your connection and try again.',
    teamAWon: 'Team A won', teamALost: 'Team A lost', draw: 'Draw', opponents: 'Opponents', details: 'Match details', back: 'Back to history',
    sets: 'Sets', formatBestOfThree: 'Best of 3 sets', goldenPoint: 'Golden point', advantage: 'Advantage', statisticsBySet: 'Statistics by set',
    player: 'Player', totalSet: 'Set total', totalMatch: 'Match totals', dateUnavailable: 'Date unavailable', refresh: 'Refresh history',
  },
} as const;

function formatDate(timestamp: Timestamp | undefined, locale: Locale, dateUnavailable: string) {
  if (!timestamp) return dateUnavailable;
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(timestamp.toDate());
}

function formatSetScores(match: MatchRecord) {
  return match.matchScore.map((set) => `${set.teamA}-${set.teamB}`).join(' · ');
}

function teamAResult(match: MatchRecord, t: Pick<typeof historyTranslations.es, 'teamAWon' | 'teamALost' | 'draw'> | Pick<typeof historyTranslations.en, 'teamAWon' | 'teamALost' | 'draw'>) {
  if (match.teamASetsWon > match.teamBSetsWon) {
    return { label: t.teamAWon, className: 'bg-green-500/10 text-green-700', won: true };
  }
  if (match.teamASetsWon < match.teamBSetsWon) {
    return { label: t.teamALost, className: 'bg-destructive/10 text-destructive', won: false };
  }
  return { label: t.draw, className: 'bg-muted text-muted-foreground', won: false };
}

function addStats(first: PlayerStats, second: PlayerStats): PlayerStats {
  return {
    winners: first.winners + second.winners,
    errors: first.errors + second.errors,
    x3: first.x3 + second.x3,
    x4: first.x4 + second.x4,
    dropshot: first.dropshot + second.dropshot,
    volley: first.volley + second.volley,
  };
}

const emptyStats: PlayerStats = { winners: 0, errors: 0, x3: 0, x4: 0, dropshot: 0, volley: 0 };
const defaultTeamBNames = { player1: 'Contrario_reves', player2: 'Contrario_drive' };

function formatTeams(match: MatchRecord, opponentsLabel: string) {
  return `${match.teamANames.player2} · ${match.teamANames.player1} vs ${opponentsLabel}`;
}

function formatOpponentPlayers(match: MatchRecord, opponentsLabel: string) {
  const teamBNames = match.teamBNames ?? defaultTeamBNames;
  return `${opponentsLabel}: ${teamBNames.player2} · ${teamBNames.player1}`;
}

export default function HistoryPage() {
  const [locale, setLocale] = useState<Locale>('es');
  const t = historyTranslations[locale];
  const [matches, setMatches] = useState<MatchRecord[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<MatchRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const matchTotals = selectedMatch
    ? selectedMatch.setStats.reduce(
        (total, setStats) => addStats(total, addStats(setStats.player1, setStats.player2)),
        emptyStats,
      )
    : emptyStats;

  useEffect(() => {
    const savedLocale = window.localStorage.getItem('padelbi-locale');
    if (savedLocale === 'es' || savedLocale === 'en') setLocale(savedLocale);
  }, []);

  const loadMatches = useCallback(async () => {
    if (!isFirebaseConfigured()) {
      setError(t.firebaseError);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const snapshot = await getDocs(collection(db, 'matches'));
      const records = snapshot.docs.map((document) => ({ id: document.id, ...document.data() } as MatchRecord));
      records.sort((first, second) => (second.createdAt?.toMillis() ?? 0) - (first.createdAt?.toMillis() ?? 0));
      setMatches(records);
    } catch {
      setError(t.loadError);
    } finally {
      setIsLoading(false);
    }
  }, [t.firebaseError, t.loadError]);

  useEffect(() => {
    void loadMatches();
  }, [loadMatches]);

  return (
    <main className="min-h-screen bg-background pb-24 text-foreground">
      <header className="sticky top-4 z-40 mx-auto mt-[calc(env(safe-area-inset-top)+1rem)] w-[calc(100%-1rem)] rounded-xl bg-primary text-primary-foreground shadow-lg sm:w-[calc(100%-2rem)]">
        <div>
          <div className="relative flex min-h-[68px] items-center justify-center px-3 text-center">
            <div>
              <h1 className="text-3xl font-bold">{t.title}</h1>
              <p className="text-sm text-primary-foreground/80">{t.subtitle}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => void loadMatches()} disabled={isLoading} className="absolute bottom-2 right-2 text-primary-foreground hover:bg-primary-foreground/20">
              <RefreshCw className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="sr-only">{t.refresh}</span>
            </Button>
          </div>
        </div>
      </header>

      <section className="w-full space-y-3 p-2 sm:p-4">
        {isLoading && (
          <div className="flex justify-center py-16 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> {t.loading}
          </div>
        )}

        {!isLoading && error && (
          <Card className="border-destructive/40">
            <CardContent className="space-y-3 p-5 text-center">
              <p>{error}</p>
              <Button onClick={() => void loadMatches()} variant="outline">{t.retry}</Button>
            </CardContent>
          </Card>
        )}

        {!isLoading && !error && matches.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <Trophy className="mx-auto mb-3 h-9 w-9 text-primary" />
              <p className="font-medium text-foreground">{t.noMatches}</p>
              <p className="mt-1 text-sm">{t.noMatchesDescription}</p>
            </CardContent>
          </Card>
        )}

        {!isLoading && !error && matches.map((match) => {
          const result = teamAResult(match, t);
          return (
            <button
              key={match.id}
              type="button"
              onClick={() => setSelectedMatch(match)}
              className="block w-full text-left"
            >
              <Card className="transition-colors hover:border-primary/60 hover:bg-muted/40">
                <CardContent className="p-4">
                  <div>
                    <div>
                      <p className="font-semibold">{formatTeams(match, t.opponents)}</p>
                      <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" />{formatDate(match.createdAt, locale, t.dateUnavailable)}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-muted-foreground">{formatSetScores(match)}</p>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex w-14 justify-center rounded-md bg-primary/10 px-2 py-1 text-lg font-bold text-primary">{match.teamASetsWon}-{match.teamBSetsWon}</span>
                      <p className={`inline-flex w-40 items-center justify-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${result.className}`}>
                        {result.won ? <Trophy className="h-3.5 w-3.5" /> : <CircleX className="h-3.5 w-3.5" />}
                        {result.label}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </button>
          );
        })}

        {selectedMatch && (
          <section className="fixed inset-0 z-[60] overflow-y-auto bg-background pb-24">
            <header className="sticky top-0 z-10 flex items-center gap-2 border-b bg-background px-4 py-3">
              <Button variant="ghost" size="icon" onClick={() => setSelectedMatch(null)}><ChevronLeft className="h-5 w-5" /><span className="sr-only">{t.back}</span></Button>
              <div>
                <h2 className="font-bold">{t.details}</h2>
                <p className="text-xs text-muted-foreground">{formatDate(selectedMatch.createdAt, locale, t.dateUnavailable)}</p>
              </div>
            </header>
            <div className="mx-auto max-w-2xl space-y-4 p-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">{formatTeams(selectedMatch, t.opponents)}</CardTitle>
                  <p className="text-sm text-muted-foreground">{formatOpponentPlayers(selectedMatch, t.opponents)}</p>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-primary">{selectedMatch.teamASetsWon} - {selectedMatch.teamBSetsWon}</p>
                  {(() => {
                    const result = teamAResult(selectedMatch, t);
                    return <p className={`mt-3 inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium ${result.className}`}>{result.won ? <Trophy className="h-4 w-4" /> : <CircleX className="h-4 w-4" />}{result.label}</p>;
                  })()}
                  <p className="mt-2 text-sm text-muted-foreground">{t.sets}: {formatSetScores(selectedMatch)}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{selectedMatch.matchFormat === 'supertiebreak' ? 'Supertiebreak to 10' : t.formatBestOfThree} · {selectedMatch.isGoldenPoint ? t.goldenPoint : t.advantage}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-lg">{t.statisticsBySet}</CardTitle></CardHeader>
                <CardContent className="overflow-x-auto p-0">
                  <Table>
                    <TableHeader><TableRow><TableHead>Set</TableHead><TableHead>{t.player}</TableHead><TableHead className="text-right">Gan.</TableHead><TableHead className="text-right">Err.</TableHead><TableHead className="text-right">X3</TableHead><TableHead className="text-right">X4</TableHead><TableHead className="text-right">Dej.</TableHead><TableHead className="text-right">Vol.</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {selectedMatch.setStats.map((setStats, index) => (
                        <Fragment key={index}>
                          <TableRow key={`${index}-player1`}><TableCell rowSpan={2}>{index + 1}</TableCell><TableCell>{selectedMatch.teamANames.player1}</TableCell><TableCell className="text-right">{setStats.player1.winners}</TableCell><TableCell className="text-right">{setStats.player1.errors}</TableCell><TableCell className="text-right">{setStats.player1.x3}</TableCell><TableCell className="text-right">{setStats.player1.x4}</TableCell><TableCell className="text-right">{setStats.player1.dropshot}</TableCell><TableCell className="text-right">{setStats.player1.volley}</TableCell></TableRow>
                          <TableRow key={`${index}-player2`}><TableCell>{selectedMatch.teamANames.player2}</TableCell><TableCell className="text-right">{setStats.player2.winners}</TableCell><TableCell className="text-right">{setStats.player2.errors}</TableCell><TableCell className="text-right">{setStats.player2.x3}</TableCell><TableCell className="text-right">{setStats.player2.x4}</TableCell><TableCell className="text-right">{setStats.player2.dropshot}</TableCell><TableCell className="text-right">{setStats.player2.volley}</TableCell></TableRow>
                          <TableRow className="bg-muted/50 font-semibold"><TableCell colSpan={2}>{t.totalSet}</TableCell><TableCell className="text-right">{setStats.player1.winners + setStats.player2.winners}</TableCell><TableCell className="text-right">{setStats.player1.errors + setStats.player2.errors}</TableCell><TableCell className="text-right">{setStats.player1.x3 + setStats.player2.x3}</TableCell><TableCell className="text-right">{setStats.player1.x4 + setStats.player2.x4}</TableCell><TableCell className="text-right">{setStats.player1.dropshot + setStats.player2.dropshot}</TableCell><TableCell className="text-right">{setStats.player1.volley + setStats.player2.volley}</TableCell></TableRow>
                        </Fragment>
                      ))}
                      <TableRow className="bg-primary/10 font-bold"><TableCell colSpan={2}>{t.totalMatch}</TableCell><TableCell className="text-right">{matchTotals.winners}</TableCell><TableCell className="text-right">{matchTotals.errors}</TableCell><TableCell className="text-right">{matchTotals.x3}</TableCell><TableCell className="text-right">{matchTotals.x4}</TableCell><TableCell className="text-right">{matchTotals.dropshot}</TableCell><TableCell className="text-right">{matchTotals.volley}</TableCell></TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </section>
        )}
      </section>
      <AppNavigation locale={locale} />
    </main>
  );
}
