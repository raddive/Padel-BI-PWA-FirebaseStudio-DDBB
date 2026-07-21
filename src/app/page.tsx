'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Undo2, Trophy, CircleOff, Users, Zap, Feather, ShieldCheck, Share2, Loader2, Edit, Languages, Settings, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import html2canvas from 'html2canvas';
import { saveMatchToFirestore } from '@/lib/save-match';
import { isFirebaseConfigured } from '@/lib/firebase';
import type { PlayerStats, TeamStats, SetScore } from '@/lib/match-types';
import { AppNavigation } from '@/components/app-navigation';

import en from '../locales/en.json';
import es from '../locales/es.json';

type Point = '0' | '15' | '30' | '40' | 'AD' | 'GAME';
type GameScore = { teamA: Point; teamB: Point };
type MatchScore = SetScore[];
type TeamNames = { player1: string; player2: string };
type LastWinnerType = 'x3' | 'x4' | 'dropshot' | 'volley' | 'general';
type TieBreakScore = { teamA: number; teamB: number };

const initialGameScore: GameScore = { teamA: '0', teamB: '0' };
const initialSetScore: SetScore = { teamA: 0, teamB: 0 };
const initialPlayerStats: PlayerStats = { winners: 0, errors: 0, x3: 0, x4: 0, dropshot: 0, volley: 0 };
const initialTeamStats: TeamStats = { player1: { ...initialPlayerStats }, player2: { ...initialPlayerStats } };
const initialTeamNames: TeamNames = { player1: 'Aleix', player2: 'Xavi' };
const initialTieBreakScore: TieBreakScore = { teamA: 0, teamB: 0 };


const pointSequence: Point[] = ['0', '15', '30', '40', 'AD', 'GAME'];
const SETS_TO_WIN = 2;

const didTeamWinSet = (setScore: SetScore, team: 'teamA' | 'teamB', matchFormat: 'bestOfThree' | 'supertiebreak', setIndexForContext?: number): boolean => {
    if (!setScore) return false;
    const opponent: 'teamA' | 'teamB' = team === 'teamA' ? 'teamB' : 'teamA';
    const teamGames = setScore[team];
    const opponentGames = setScore[opponent];

    if (matchFormat === 'supertiebreak' && setIndexForContext === 2) {
        return teamGames === 1; // In supertiebreak, winning the 3rd set means score is 1-0
    }

    // Standard set win conditions
    return (
        (teamGames === 6 && teamGames >= opponentGames + 2) ||
        teamGames === 7 // Handles 7-5 or 7-6 (tiebreak win)
    );
};


const translations = { en, es };

export default function PadelCounter() {
  const [locale, setLocale] = useState<'en' | 'es'>('es');
  const t = translations[locale];

  const [matchScore, setMatchScore] = useState<MatchScore>([initialSetScore]);
  const [currentGameScore, setCurrentGameScore] = useState<GameScore>(initialGameScore);
  const [currentSetIndex, setCurrentSetIndex] = useState(0);
  const [teamAStats, setTeamAStats] = useState<TeamStats>(initialTeamStats);
  const [teamANames, setTeamANames] = useState<TeamNames>({ player1: t.player1NamePlaceholder, player2: t.player2NamePlaceholder });
  const [setStats, setSetStats] = useState<TeamStats[]>([]);
  const [matchOver, setMatchOver] = useState(false);
  const [showSetSummary, setShowSetSummary] = useState(false);
  const [currentSetStatsSummary, setCurrentSetStatsSummary] = useState<TeamStats>(initialTeamStats);
  const [finalMatchScore, setFinalMatchScore] = useState<MatchScore | null>(null);
  const [finalStats, setFinalStats] = useState<TeamStats[] | null>(null);
  const [isUpdatingGame, setIsUpdatingGame] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [lastWinnerActionPlayer1, setLastWinnerActionPlayer1] = useState<LastWinnerType | null>(null);
  const [lastWinnerActionPlayer2, setLastWinnerActionPlayer2] = useState<LastWinnerType | null>(null);
  const [showNameInputs, setShowNameInputs] = useState(false);
  const { toast } = useToast();
  const summaryRef = useRef<HTMLDivElement | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [isSettingsPopoverOpen, setIsSettingsPopoverOpen] = useState(false);
  const [isTieBreakActive, setIsTieBreakActive] = useState(false);
  const [tieBreakScore, setTieBreakScore] = useState<TieBreakScore>(initialTieBreakScore);
  const processedSetsRef = useRef<Set<number>>(new Set());
  const [showFinalSummaryDetails, setShowFinalSummaryDetails] = useState(false);
  const [isGoldenPoint, setIsGoldenPoint] = useState<boolean>(false);
  const [matchFormat, setMatchFormat] = useState<'bestOfThree' | 'supertiebreak'>('bestOfThree');

  const updateGameScore = React.useCallback((winningTeam: 'teamA' | 'teamB') => {
    const wasTieBreakWhenPointWon = isTieBreakActive;
    let isCurrentSetSupertiebreak = false;

    if (matchFormat === 'supertiebreak' && currentSetIndex === 2) {
        const prevSets = matchScore.slice(0, 2);
        const teamASetsWon = prevSets.filter((s, i) => s && didTeamWinSet(s, 'teamA', matchFormat, i)).length;
        const teamBSetsWon = prevSets.filter((s, i) => s && didTeamWinSet(s, 'teamB', matchFormat, i)).length;
        if (teamASetsWon === 1 && teamBSetsWon === 1) {
            isCurrentSetSupertiebreak = true;
        }
    }

    setMatchScore(prevMatchScore => {
      const newMatchScore = [...prevMatchScore];
       if (currentSetIndex >= newMatchScore.length) {
          while (newMatchScore.length <= currentSetIndex) {
               newMatchScore.push({...initialSetScore});
          }
       }
      const currentSetMutable = { ...newMatchScore[currentSetIndex] };
      const losingTeam = winningTeam === 'teamA' ? 'teamB' : 'teamA';

      if (wasTieBreakWhenPointWon) {
          if (isCurrentSetSupertiebreak) {
              currentSetMutable[winningTeam] = 1; // Supertiebreak "set" score is 1-0
              currentSetMutable[losingTeam] = 0;
          } else {
              // Standard tiebreak win, games go to 7
              currentSetMutable[winningTeam] = 7;
              currentSetMutable[losingTeam] = tieBreakScore[losingTeam]; 
          }
      } else {
          currentSetMutable[winningTeam]++;
      }
      newMatchScore[currentSetIndex] = currentSetMutable;

      if (!wasTieBreakWhenPointWon &&
          !isCurrentSetSupertiebreak &&
          currentSetMutable.teamA === 6 &&
          currentSetMutable.teamB === 6
      ) {
          setIsTieBreakActive(true);
          setTieBreakScore(initialTieBreakScore);
      }
      return newMatchScore;
    });

    if (wasTieBreakWhenPointWon) {
        setIsTieBreakActive(false);
        setTieBreakScore(initialTieBreakScore);
    }
  }, [isTieBreakActive, matchFormat, currentSetIndex, matchScore, tieBreakScore]);


  useEffect(() => {
    if (teamANames.player1 === translations.en.player1NamePlaceholder || teamANames.player1 === translations.es.player1NamePlaceholder || teamANames.player1 === initialTeamNames.player1) {
      setTeamANames(prev => ({...prev, player1: t.player1NamePlaceholder}));
    }
    if (teamANames.player2 === translations.en.player2NamePlaceholder || teamANames.player2 === translations.es.player2NamePlaceholder || teamANames.player2 === initialTeamNames.player2) {
      setTeamANames(prev => ({...prev, player2: t.player2NamePlaceholder}));
    }
  }, [locale, t.player1NamePlaceholder, t.player2NamePlaceholder, teamANames.player1, teamANames.player2]);


  useEffect(() => {
    if (isUpdatingGame) {
      const winningTeam = currentGameScore.teamA === 'GAME' ? 'teamA' : currentGameScore.teamB === 'GAME' ? 'teamB' : null;
      if (winningTeam) {
          updateGameScore(winningTeam);
          setCurrentGameScore(initialGameScore);
          setIsUpdatingGame(false);
      }
    }
  }, [isUpdatingGame, currentGameScore, updateGameScore]);


  const handleSetEnd = React.useCallback(() => {
    if (showSetSummary || matchOver || processedSetsRef.current.has(currentSetIndex)) {
        return;
    }
    const finalSetScoreForCallback = matchScore[currentSetIndex];
    if (!finalSetScoreForCallback) return;


    const statsForThisSet = { ...teamAStats };
    setCurrentSetStatsSummary(statsForThisSet);
    setSetStats(prev => [...prev, statsForThisSet]);
    setShowSetSummary(true);
    processedSetsRef.current.add(currentSetIndex);


    const scoreIncludingCurrentSet = [...matchScore.slice(0, currentSetIndex), finalSetScoreForCallback];
    const teamASets = scoreIncludingCurrentSet.filter((set, index) => set && didTeamWinSet(set, 'teamA', matchFormat, index)).length;
    const teamBSets = scoreIncludingCurrentSet.filter((set, index) => set && didTeamWinSet(set, 'teamB', matchFormat, index)).length;

    if (matchFormat === 'supertiebreak' && teamASets === 1 && teamBSets === 1 && currentSetIndex === 1) {
        setMatchOver(false);
    } else if (teamASets === SETS_TO_WIN || teamBSets === SETS_TO_WIN) {
        setMatchOver(true);
        const finalScore = scoreIncludingCurrentSet.slice(0, currentSetIndex + 1);
        const allStats = [...setStats, statsForThisSet];
        setFinalMatchScore(finalScore);
        setFinalStats(allStats);

        if (isFirebaseConfigured()) {
          const teamASetsWon = finalScore.filter((set, index) => set && didTeamWinSet(set, 'teamA', matchFormat, index)).length;
          const teamBSetsWon = finalScore.filter((set, index) => set && didTeamWinSet(set, 'teamB', matchFormat, index)).length;
          saveMatchToFirestore({
            teamANames,
            matchScore: finalScore,
            setStats: allStats,
            matchFormat,
            isGoldenPoint,
            teamASetsWon,
            teamBSetsWon,
          })
            .then(() => {
              toast({ title: t.toastMatchSavedTitle, description: t.toastMatchSavedDescription });
            })
            .catch(() => {
              toast({ variant: 'destructive', title: t.toastMatchSaveFailedTitle, description: t.toastMatchSaveFailedDescription });
            });
        }
    }
  }, [showSetSummary, matchOver, currentSetIndex, teamAStats, matchScore, setStats, matchFormat, teamANames, isGoldenPoint, toast, t.toastMatchSavedTitle, t.toastMatchSavedDescription, t.toastMatchSaveFailedTitle, t.toastMatchSaveFailedDescription]);


  useEffect(() => {
    const currentSet = matchScore[currentSetIndex];

    if (isUpdatingGame || matchOver || showSetSummary || !currentSet) {
      return;
    }

    const teamAWon = didTeamWinSet(currentSet, 'teamA', matchFormat, currentSetIndex);
    const teamBWon = didTeamWinSet(currentSet, 'teamB', matchFormat, currentSetIndex);


    if (teamAWon || teamBWon) {
      if (!processedSetsRef.current.has(currentSetIndex)) {
        handleSetEnd();
      }
    }
  }, [matchScore, currentSetIndex, isUpdatingGame, matchOver, showSetSummary, handleSetEnd, matchFormat]);


  const updatePoint = (team: 'teamA' | 'teamB', increment: boolean) => {
    if (matchOver || isUpdatingGame) return;

    if (isTieBreakActive) {
        setTieBreakScore(prevTieBreakScore => {
            let newScoreA = prevTieBreakScore.teamA;
            let newScoreB = prevTieBreakScore.teamB;
            let tieBreakWinner: 'teamA' | 'teamB' | null = null;

            if (increment) {
                if (team === 'teamA') newScoreA++;
                else newScoreB++;
            } else {
                if (team === 'teamA' && newScoreA > 0) newScoreA--;
                else if (team === 'teamB' && newScoreB > 0) newScoreB--;
            }

            let targetScoreForTieBreak = 7;
            if (matchFormat === 'supertiebreak' && currentSetIndex === 2) {
                const previousSets = matchScore.slice(0, 2);
                const teamASetsActuallyWon = previousSets.filter((set, idx) => set && didTeamWinSet(set, 'teamA', matchFormat, idx)).length;
                const teamBSetsActuallyWon = previousSets.filter((set, idx) => set && didTeamWinSet(set, 'teamB', matchFormat, idx)).length;

                if (teamASetsActuallyWon === 1 && teamBSetsActuallyWon === 1) {
                    targetScoreForTieBreak = 10;
                }
            }


            if (newScoreA >= targetScoreForTieBreak && newScoreA >= newScoreB + 2) {
                tieBreakWinner = 'teamA';
            } else if (newScoreB >= targetScoreForTieBreak && newScoreB >= newScoreA + 2) {
                tieBreakWinner = 'teamB';
            }

            if (tieBreakWinner) {
                setIsUpdatingGame(true);
                setCurrentGameScore(tieBreakWinner === 'teamA' ? { teamA: 'GAME', teamB: '0' } : { teamA: '0', teamB: 'GAME' });
            }
            return { teamA: newScoreA, teamB: newScoreB };
        });
    } else {
        setCurrentGameScore(prevScore => {
          const opponent: 'teamA' | 'teamB' = team === 'teamA' ? 'teamB' : 'teamA';
          let currentPoint = prevScore[team];
          let opponentPoint = prevScore[opponent];
          let newPoint = currentPoint;
          let newOpponentPoint = opponentPoint;
          let gameWonBy: 'teamA' | 'teamB' | null = null;

          if (increment) {
            if (currentPoint === '0') newPoint = '15';
            else if (currentPoint === '15') newPoint = '30';
            else if (currentPoint === '30') newPoint = '40';
            else if (currentPoint === '40') {
              if (opponentPoint === '40') {
                if (isGoldenPoint) {
                  gameWonBy = team;
                  newPoint = 'GAME';
                } else {
                  newPoint = 'AD';
                }
              } else if (opponentPoint === 'AD') {
                 newPoint = '40';
                 newOpponentPoint = '40';
              } else {
                gameWonBy = team;
                newPoint = 'GAME';
              }
            } else if (currentPoint === 'AD') {
              gameWonBy = team;
              newPoint = 'GAME';
            }
          } else { 
            if (currentPoint === 'AD') newPoint = '40';
            else if (currentPoint === '40' && opponentPoint === 'AD') {
                if (opponentPoint === 'AD') { 
                    newOpponentPoint = '40'; 
                } else {
                     newPoint = '30'; 
                }
            }
            else if (currentPoint === '40') newPoint = '30';
            else if (currentPoint === '30') newPoint = '15';
            else if (currentPoint === '15') newPoint = '0';
          }

           if (gameWonBy) {
             setIsUpdatingGame(true);
             return { ...initialGameScore, [gameWonBy]: 'GAME' };
           } else {
             if (newOpponentPoint !== opponentPoint) { 
                return { ...prevScore, [team]: newPoint, [opponent]: newOpponentPoint };
             }
             return { ...prevScore, [team]: newPoint }; 
           }
        });
    }
  };


  const updateStat = (
    player: 'player1' | 'player2',
    statType: 'winners' | 'errors' | 'x3' | 'x4' | 'dropshot' | 'volley',
    incrementStat: boolean
  ) => {
    if (matchOver || isUpdatingGame) return;

    if (incrementStat) {
      let teamToAwardPoint: 'teamA' | 'teamB' | null = null;
      let newLastWinnerTypeForPlayer: LastWinnerType | null = null;

      setTeamAStats(prevStats => {
        const newStats = { ...prevStats };
        const playerStatCopy = { ...newStats[player] };

        if (['x3', 'x4', 'dropshot', 'volley'].includes(statType)) {
          playerStatCopy[statType as 'x3' | 'x4' | 'dropshot' | 'volley']++;
          playerStatCopy.winners++;
        } else if (statType === 'winners') {
          playerStatCopy.winners++;
        } else if (statType === 'errors') {
          playerStatCopy.errors++;
        }
        newStats[player] = playerStatCopy;
        return newStats;
      });

      if (['x3', 'x4', 'dropshot', 'volley'].includes(statType)) {
        newLastWinnerTypeForPlayer = statType as LastWinnerType;
        teamToAwardPoint = 'teamA';
      } else if (statType === 'winners') {
        newLastWinnerTypeForPlayer = 'general';
        teamToAwardPoint = 'teamA';
      } else if (statType === 'errors') {
        teamToAwardPoint = 'teamB';
      }

      if (teamToAwardPoint) {
        updatePoint(teamToAwardPoint, true);
      }
      if (newLastWinnerTypeForPlayer) {
        if (player === 'player1') {
          setLastWinnerActionPlayer1(newLastWinnerTypeForPlayer);
        } else {
          setLastWinnerActionPlayer2(newLastWinnerTypeForPlayer);
        }
      }
    } else {
      const playerToUpdate = player;
      const statToDecrement = statType;

      setTeamAStats(prevStats => {
        const newStats = { ...prevStats };
        const playerStatCopy = { ...newStats[playerToUpdate] };

        if (statToDecrement === 'errors' && playerStatCopy.errors > 0) {
            playerStatCopy.errors--;
            updatePoint('teamB', false); 
        }
        newStats[playerToUpdate] = playerStatCopy;
        return newStats;
      });
    }
  };

  const undoLastWinner = (player: 'player1' | 'player2') => {
     if (matchOver || isUpdatingGame) return;
     
     const lastWinnerAction = player === 'player1' ? lastWinnerActionPlayer1 : lastWinnerActionPlayer2;
     const setLastWinner = player === 'player1' ? setLastWinnerActionPlayer1 : setLastWinnerActionPlayer2;

     if (!lastWinnerAction) return; 

     setTeamAStats(prevStats => {
         const newStats = { ...prevStats };
         const playerStatCopy = { ...newStats[player] };

         if (playerStatCopy.winners > 0) {
             playerStatCopy.winners--;
         }
         if (lastWinnerAction && lastWinnerAction !== 'general' && playerStatCopy[lastWinnerAction as 'x3' | 'x4' | 'dropshot' | 'volley'] > 0) {
            playerStatCopy[lastWinnerAction as 'x3' | 'x4' | 'dropshot' | 'volley']--;
         }

         newStats[player] = playerStatCopy;
         updatePoint('teamA', false); 
         return newStats;
     });
     setLastWinner(null); 
  };

  const handleNameChange = (player: 'player1' | 'player2', name: string) => {
    setTeamANames(prevNames => ({
        ...prevNames,
        [player]: name
    }));
  };

  const restoreDefaultNameIfEmpty = (player: 'player1' | 'player2') => {
    setTeamANames(prevNames => {
      const trimmedName = prevNames[player].trim();
      return {
        ...prevNames,
        [player]: trimmedName || (player === 'player1' ? t.player1NamePlaceholder : t.player2NamePlaceholder),
      };
    });
  };

  const toggleNameInputs = () => {
    setShowNameInputs(prev => !prev);
  };

  const resetTeamAStats = () => {
    setTeamAStats(initialTeamStats);
    setLastWinnerActionPlayer1(null);
    setLastWinnerActionPlayer2(null);
  };

  const resetMatch = () => {
    setMatchScore([initialSetScore]);
    setCurrentGameScore(initialGameScore);
    setCurrentSetIndex(0);
    setTeamAStats(initialTeamStats);
    setTeamANames({ player1: t.player1NamePlaceholder, player2: t.player2NamePlaceholder });
    setSetStats([]);
    setMatchOver(false);
    setShowSetSummary(false);
    setCurrentSetStatsSummary(initialTeamStats);
    setFinalMatchScore(null);
    setFinalStats(null);
    setIsUpdatingGame(false);
    setShowResetDialog(false);
    setLastWinnerActionPlayer1(null);
    setLastWinnerActionPlayer2(null);
    if (typeof window !== 'undefined') {
      summaryRef.current = null;
    }
    setShowNameInputs(false);
    setIsSettingsPopoverOpen(false);
    setIsTieBreakActive(false);
    setTieBreakScore(initialTieBreakScore);
    processedSetsRef.current.clear();
    setShowFinalSummaryDetails(false);
    setIsGoldenPoint(false);
    setMatchFormat('bestOfThree');
  };

  const closeSetSummary = () => {
      setShowSetSummary(false);
      if (!matchOver) {
           resetTeamAStats(); 
           const previousSetIndex = currentSetIndex;
           const newCurrentSetIndex = previousSetIndex + 1;
           setCurrentSetIndex(newCurrentSetIndex);

           setMatchScore(prev => {
               let newScore = [...prev];
               while (newScore.length <= newCurrentSetIndex) {
                    newScore = [...newScore, {...initialSetScore}];
               }
               return newScore;
           });

           const setsPlayedAndScored = matchScore.slice(0, previousSetIndex + 1);
           const teamASetsWonSoFar = setsPlayedAndScored.filter((set, index) => set && didTeamWinSet(set, 'teamA', matchFormat, index)).length;
           const teamBSetsWonSoFar = setsPlayedAndScored.filter((set, index) => set && didTeamWinSet(set, 'teamB', matchFormat, index)).length;

           if (
               matchFormat === 'supertiebreak' &&
               teamASetsWonSoFar === 1 &&
               teamBSetsWonSoFar === 1 &&
               newCurrentSetIndex === 2 
           ) {
               setIsTieBreakActive(true); 
               setTieBreakScore(initialTieBreakScore);
               setCurrentGameScore(initialGameScore); 
           } else {
               setIsTieBreakActive(false); 
               setTieBreakScore(initialTieBreakScore);
               setCurrentGameScore(initialGameScore);
           }
       }
  };

  const getCurrentSetScore = (): SetScore => {
     return matchScore[currentSetIndex] || initialSetScore;
  };

  const scoreToAnalyze = finalMatchScore || matchScore;
  const setsToConsider = scoreToAnalyze.slice(0, finalMatchScore ? scoreToAnalyze.length : currentSetIndex + 1);
  const teamASetsWon = setsToConsider.filter((set, index) => set && didTeamWinSet(set, 'teamA', matchFormat, index)).length;
  const teamBSetsWon = setsToConsider.filter((set, index) => set && didTeamWinSet(set, 'teamB', matchFormat, index)).length;


 const handleShareSummary = async () => {
    if (!summaryRef.current) {
        toast({
            variant: 'destructive',
            title: t.toastSharingFailedTitle,
            description: "Summary element not found.",
        });
        return;
    }

    setIsSharing(true);

    try {
        await new Promise(resolve => setTimeout(resolve, 100)); 
        const canvas = await html2canvas(summaryRef.current, {
            useCORS: true,
            scale: 2,
            backgroundColor: '#ffffff',
            onclone: (clonedDocument) => {
                const clonedCard = clonedDocument.querySelector('[data-summary-card]');
                if (clonedCard instanceof HTMLElement) {
                    clonedCard.style.backgroundColor = 'hsl(0, 0%, 100%)'; 
                    clonedCard.style.color = 'hsl(240, 10%, 3.9%)'; 

                    const cardHeader = clonedCard.querySelector('div[class*="bg-primary"]');
                    if (cardHeader instanceof HTMLElement) {
                        cardHeader.style.backgroundColor = 'hsl(35, 90%, 55%)'; 
                        cardHeader.style.color = 'hsl(0, 0%, 100%)'; 
                        cardHeader.querySelectorAll('h1, h2, h3, h4, h5, h6, div, span, p').forEach(headerTextEl => {
                            if (headerTextEl instanceof HTMLElement) headerTextEl.style.color = 'hsl(0, 0%, 100%)';
                        });
                    }

                    clonedCard.querySelectorAll('th, .text-muted-foreground').forEach(el => {
                        if (el instanceof HTMLElement) el.style.color = 'hsl(240, 3.8%, 46.1%)'; 
                    });

                    clonedCard.querySelectorAll('td, p, span:not(.text-muted-foreground):not(.text-primary-foreground), div:not([class*="bg-primary"]) > span').forEach(el => {
                         if (el instanceof HTMLElement && !el.closest('div[class*="bg-primary"]')) { 
                            el.style.color = 'hsl(240, 5.9%, 10%)'; 
                        }
                    });

                     clonedCard.querySelectorAll('tr[class*="bg-muted\\/50"]').forEach(row => { 
                        if (row instanceof HTMLElement) {
                             row.style.backgroundColor = 'hsl(240, 4.8%, 95.9%)'; 
                             row.querySelectorAll('td, span').forEach(cellEl => {
                                 if(cellEl instanceof HTMLElement) cellEl.style.color = 'hsl(240, 5.9%, 10%)';
                             });
                        }
                    });
                     clonedCard.querySelectorAll('tr[class*="bg-primary\\/10"]').forEach(row => { 
                        if (row instanceof HTMLElement) {
                            row.style.backgroundColor = 'hsla(35, 90%, 55%, 0.1)'; 
                            row.querySelectorAll('td, span').forEach(cellEl => {
                                 if(cellEl instanceof HTMLElement) cellEl.style.color = 'hsl(240, 5.9%, 10%)';
                             });
                        }
                    });
                }
            }
        });
        const dataUrl = canvas.toDataURL('image/png');

        const shareText = matchOver ?
            `${t.finalScoreTeamA.replace('{score}', summaryCardTeamASetsWon.toString())} - ${t.finalScoreTeamB.replace('{score}', summaryCardTeamBSetsWon.toString())}` :
            `${t.inProgressScore.replace('{teamA}', teamANames.player1 + " & " + teamANames.player2).replace('{setsA}', summaryCardTeamASetsWon.toString()).replace('{setsB}', summaryCardTeamBSetsWon.toString())}`;

        if (navigator.share) {
            try {
                const response = await fetch(dataUrl);
                const blob = await response.blob();
                const file = new File([blob], 'padel-summary.png', { type: 'image/png' });

                await navigator.share({
                    title: t.matchSummaryTitle,
                    text: shareText,
                    files: [file],
                });
                toast({
                    title: t.toastSummarySharedTitle,
                    description: t.toastSummarySharedDescription,
                });
            } catch (error: unknown) {
                const err = error as { name?: string; message?: string };
                if (err.name === 'AbortError') {
                    toast({
                        variant: 'default',
                        title: t.toastSharingCancelledTitle,
                        description: t.toastSharingCancelledDescription,
                    });
                } else {
                    toast({
                        variant: 'destructive',
                        title: t.toastSharingFailedTitle,
                        description: `${t.toastSharingFailedDescription}${err.message ? ` (${err.message})` : ''}`,
                    });
                }
            }
        } else {
            toast({
                variant: 'destructive',
                title: t.toastSharingNotSupportedTitle,
                description: t.toastSharingNotSupportedDescription,
            });
        }
    } catch (canvasError: unknown) {
        const err = canvasError as { message?: string };
        toast({
            variant: 'destructive',
            title: t.toastSharingFailedTitle,
            description: `${t.toastSharingFailedDescription} (Error: ${err.message || t.errorImageGenerationFailed})`,
        });
    } finally {
         setIsSharing(false);
    }
 };

 const toggleLocale = () => {
    setLocale(prevLocale => (prevLocale === 'en' ? 'es' : 'en'));
 };

 const summaryCardMatchData = useMemo(() => finalMatchScore || matchScore, [finalMatchScore, matchScore]);

 const summaryCardStatsData = useMemo(() => {
    if (matchOver && finalStats) {
        return finalStats;
    }
    const inProgressDisplayStats = [...setStats];
    if (!matchOver || (matchOver && !finalStats)) {
         const isCurrentSetAlreadyInSetStats = setStats.length > currentSetIndex;

         if (!isCurrentSetAlreadyInSetStats) {
            inProgressDisplayStats.push(teamAStats);
         }
    }
    return inProgressDisplayStats.filter((statSet, index) => {
        const player1Empty = Object.values(statSet.player1).every(v => v === 0);
        const player2Empty = Object.values(statSet.player2).every(v => v === 0);
        const setScore = summaryCardMatchData[index];
        const scoreRecorded = setScore && (setScore.teamA > 0 || setScore.teamB > 0);
        return !(player1Empty && player2Empty && !scoreRecorded && index > 0);
    });
 }, [matchOver, finalStats, setStats, teamAStats, currentSetIndex, summaryCardMatchData]);


 const summaryCardTeamASetsWon = useMemo(() => {
    return summaryCardMatchData.filter((set, index) => set && didTeamWinSet(set, 'teamA', matchFormat, index)).length;
 }, [summaryCardMatchData, matchFormat]);

 const summaryCardTeamBSetsWon = useMemo(() => {
    return summaryCardMatchData.filter((set, index) => set && didTeamWinSet(set, 'teamB', matchFormat, index)).length;
 }, [summaryCardMatchData, matchFormat]);

 const SETTINGS_DISABLED = matchOver;


 const exportSummaryToCSV = () => {
    const csvRows: string[][] = [];
    const numSetsWithStats = summaryCardStatsData.length;

    const statKeys: (keyof PlayerStats)[] = ['winners', 'errors', 'x3', 'x4', 'dropshot', 'volley'];
    const statTranslations = {
        winners: t.winners,
        errors: t.errors,
        x3: t.tableX3,
        x4: t.tableX4,
        dropshot: t.tableDropshot,
        volley: t.tableVolley
    };

    const statsHeaderRow: string[] = [t.player];
    for (let i = 0; i < numSetsWithStats; i++) {
        const setNumberDisplay = (i + 1).toString();
        const setScoreForHeader = summaryCardMatchData[i];
        let headerSetSuffix = "";

        if (matchFormat === 'supertiebreak' && i === 2) {
            headerSetSuffix = ` (${t.tieBreakShort})`;
        } else if (setScoreForHeader && (setScoreForHeader.teamA === 7 || setScoreForHeader.teamB === 7)) {
            headerSetSuffix = ` (${t.tieBreakShort})`;
        }

        statKeys.forEach(statKey => {
            statsHeaderRow.push(`${t.set} ${setNumberDisplay}${headerSetSuffix} - ${statTranslations[statKey]}`);
        });
    }
    statKeys.forEach(statKey => {
        statsHeaderRow.push(`${t.matchTotals} - ${statTranslations[statKey]}`);
    });
    csvRows.push(statsHeaderRow);

    const playersToExport = [
        { name: teamANames.player1, dataKey: 'player1' as const },
        { name: teamANames.player2, dataKey: 'player2' as const },
    ];

    playersToExport.forEach(playerInfo => {
        const playerRow: string[] = [playerInfo.name];
        const playerMatchTotals: PlayerStats = { ...initialPlayerStats };

        for (let i = 0; i < numSetsWithStats; i++) {
            const setStatForPlayer = summaryCardStatsData[i][playerInfo.dataKey];
            statKeys.forEach(statKey => {
                const value = setStatForPlayer[statKey];
                playerRow.push(value.toString());
                (playerMatchTotals[statKey] as number) += value;
            });
        }
        statKeys.forEach(statKey => {
            playerRow.push(playerMatchTotals[statKey].toString());
        });
        csvRows.push(playerRow);
    });

    const teamATotalsRow: string[] = [t.teamA];
    const teamAMatchTotals: PlayerStats = { ...initialPlayerStats };
    for (let i = 0; i < numSetsWithStats; i++) {
        const setStatP1 = summaryCardStatsData[i].player1;
        const setStatP2 = summaryCardStatsData[i].player2;
        statKeys.forEach(statKey => {
            const value = setStatP1[statKey] + setStatP2[statKey];
            teamATotalsRow.push(value.toString());
            (teamAMatchTotals[statKey] as number) += value;
        });
    }
    statKeys.forEach(statKey => {
        teamATotalsRow.push(teamAMatchTotals[statKey].toString());
    });
    csvRows.push(teamATotalsRow);

    csvRows.push([]); 

    const setScoresHeaderRowGenerated: string[] = [t.setScoresLabel, ''];
    const setScoresDataRowGenerated: string[] = [`${teamANames.player1} & ${teamANames.player2} vs ${t.teamB}`, ''];
    
    const relevantSetsForScores = summaryCardMatchData.filter((set, index) => {
      return set && (index < numSetsWithStats || (index === currentSetIndex && (set.teamA > 0 || set.teamB > 0 || isTieBreakActive)));
    });

    relevantSetsForScores.forEach((set, i) => { 
        if (!set) return;
        const originalSetIndex = summaryCardMatchData.indexOf(set); 

        setScoresHeaderRowGenerated.push(`${t.set} ${originalSetIndex + 1}`);
        let scoreDisplay = `${set.teamA}-${set.teamB}`;
        const isSupertiebreakSet = matchFormat === 'supertiebreak' && originalSetIndex === 2 && (set.teamA === 1 || set.teamB === 1);
        const isStandardTiebreakSet = (set.teamA === 7 || set.teamB === 7) && !(matchFormat === 'supertiebreak' && originalSetIndex === 2) ;
        
        if (isSupertiebreakSet || isStandardTiebreakSet) {
            scoreDisplay += ` (${t.tieBreakShort})`;
        }
        setScoresDataRowGenerated.push(scoreDisplay);
    });

    setScoresHeaderRowGenerated.push(t.finalScoreLabel);
    setScoresDataRowGenerated.push(`${summaryCardTeamASetsWon}-${summaryCardTeamBSetsWon}`);
    csvRows.push(setScoresHeaderRowGenerated);
    csvRows.push(setScoresDataRowGenerated);

    const csvString = csvRows.map(row => row.join(',')).join('\n');
    
    try {
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        if (link.download !== undefined) { 
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            
            const now = new Date();
            const year = now.getFullYear();
            const month = (now.getMonth() + 1).toString().padStart(2, '0');
            const day = now.getDate().toString().padStart(2, '0');
            const hours = now.getHours().toString().padStart(2, '0');
            const minutes = now.getMinutes().toString().padStart(2, '0');
            const fileName = `padelBI_${year}${month}${day}_${hours}${minutes}.csv`;

            link.setAttribute('download', fileName);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            toast({ title: t.csvExportSuccessTitle, description: t.csvExportSuccessMessage });
        } else {
            throw new Error('Browser does not support automatic downloads.');
        }
    } catch (error) {
        toast({ variant: 'destructive', title: t.csvExportErrorTitle, description: t.csvExportErrorMessage });
    }
};


  return (
    <>
      {/* Fixed Header Section */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-primary text-primary-foreground shadow-lg rounded-b-lg">
        <div className="pt-8"> {/* For status bar */}
          <div className="relative text-center p-4">
            <div className="mx-auto">
              <h1 className="text-3xl font-bold">{t.appTitle}</h1>
              {matchOver && <p className="text-primary-foreground/80 font-semibold">{t.matchFinished}</p>}
            </div>
            <div className="absolute top-1/2 right-2 sm:right-4 -translate-y-1/2">
              <Popover open={isSettingsPopoverOpen} onOpenChange={setIsSettingsPopoverOpen}>
                  <PopoverTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/20 focus-visible:ring-2 focus-visible:ring-primary-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-primary">
                          <Settings className="w-5 h-5" />
                          <span className="sr-only">{t.settingsTitle}</span>
                      </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-auto p-4 space-y-4">
                      <div>
                          <h4 className="font-medium leading-none mb-2">{t.languageSettings}</h4>
                          <Button onClick={() => { toggleLocale(); setIsSettingsPopoverOpen(false); }} variant="outline" size="sm" className="w-full flex items-center gap-1">
                              <Languages className="w-4 h-4" />
                              {locale === 'en' ? t.languageToggleEN : t.languageToggleES}
                          </Button>
                      </div>
                       <Separator />
                       <div>
                          <h4 className="font-medium leading-none mb-2">{t.teamNameSettings}</h4>
                          <Button onClick={() => { toggleNameInputs(); }} variant="outline" size="sm" className="w-full mb-2 flex items-center gap-1" disabled={SETTINGS_DISABLED}>
                              <Edit className="w-4 h-4" /> {showNameInputs ? t.hideTeamNames : t.editTeamNames}
                          </Button>
                          {showNameInputs && (
                              <Card className="bg-card border border-border rounded-lg shadow-md mt-2">
                                  <CardHeader className="p-3">
                                      <CardTitle className="text-base text-center text-card-foreground flex items-center justify-center gap-2">
                                          <Users className="w-4 h-4" /> {t.teamAPlayerNames}
                                      </CardTitle>
                                  </CardHeader>
                                  <CardContent className="grid grid-cols-1 gap-3 p-3 pt-0">
                                      <div className="space-y-1">
                                          <Input
                                              id="player1NamePopover"
                                              value={teamANames.player1}
                                              onChange={(e) => handleNameChange('player1', e.target.value)}
                                              onBlur={() => restoreDefaultNameIfEmpty('player1')}
                                              placeholder={t.player1NamePlaceholder}
                                              className="bg-background h-9"
                                              disabled={SETTINGS_DISABLED}
                                          />
                                      </div>
                                      <div className="space-y-1">
                                          <Input
                                              id="player2NamePopover"
                                              value={teamANames.player2}
                                              onChange={(e) => handleNameChange('player2', e.target.value)}
                                              onBlur={() => restoreDefaultNameIfEmpty('player2')}
                                              placeholder={t.player2NamePlaceholder}
                                              className="bg-background h-9"
                                              disabled={SETTINGS_DISABLED}
                                          />
                                      </div>
                                  </CardContent>
                              </Card>
                          )}
                      </div>
                      <Separator />
                      <div>
                          <h4 className="font-medium leading-none mb-2">{t.matchSettings}</h4>
                          <div className="space-y-3">
                              <div className="flex items-center space-x-2">
                                  <Checkbox
                                      id="goldenPoint"
                                      checked={isGoldenPoint}
                                      onCheckedChange={(checked) => setIsGoldenPoint(Boolean(checked))}
                                      disabled={SETTINGS_DISABLED}
                                  />
                                  <Label htmlFor="goldenPoint" className={SETTINGS_DISABLED ? "text-muted-foreground" : ""}>{t.goldenPoint}</Label>
                              </div>
                              <div>
                                  <Label className={SETTINGS_DISABLED ? "text-muted-foreground" : ""}>{t.matchFormat}</Label>
                                  <RadioGroup
                                      value={matchFormat}
                                      onValueChange={(value: 'bestOfThree' | 'supertiebreak') => setMatchFormat(value)}
                                      className="mt-1"
                                      disabled={SETTINGS_DISABLED}
                                  >
                                      <div className="flex items-center space-x-2">
                                          <RadioGroupItem value="bestOfThree" id="bestOfThree" disabled={SETTINGS_DISABLED} />
                                          <Label htmlFor="bestOfThree" className={SETTINGS_DISABLED ? "text-muted-foreground" : ""}>{t.bestOfThreeSets}</Label>
                                      </div>
                                      <div className="flex items-center space-x-2">
                                          <RadioGroupItem value="supertiebreak" id="supertiebreak" disabled={SETTINGS_DISABLED} />
                                          <Label htmlFor="supertiebreak" className={SETTINGS_DISABLED ? "text-muted-foreground" : ""}>{t.supertiebreakTo10}</Label>
                                      </div>
                                  </RadioGroup>
                              </div>
                          </div>
                      </div>
                  </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Content Section */}
      <div className="mt-28 min-h-screen w-full flex flex-col bg-background p-2 pb-24 text-foreground sm:p-4 sm:pb-24">
        <Card className="w-full mb-4 shadow-lg border border-border rounded-lg">
          <CardContent className="py-3 px-1">
            <div className="grid grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-6 text-center items-start">
              <div>
                <h3 className="text-base sm:text-lg font-semibold mb-1 sm:mb-2 text-muted-foreground">{t.sets}</h3>
                <div className="flex justify-center items-center gap-1 sm:gap-2 text-3xl sm:text-4xl font-bold">
                   <span>{teamASetsWon}</span>
                   <span>-</span>
                   <span>{teamBSetsWon}</span>
                </div>
                 <div className="text-xs text-muted-foreground mt-1">
                      {matchScore.slice(0, currentSetIndex).map((set, index) => (
                        <span key={index} className="mr-1">{set.teamA}-{set.teamB}</span>
                      ))}
                  </div>
              </div>

              <div>
                <h3 className="text-base sm:text-lg font-semibold mb-1 sm:mb-2 text-muted-foreground">{t.games}</h3>
                <div className="flex justify-center items-center gap-1 sm:gap-2 text-3xl sm:text-4xl font-bold">
                  <span>{getCurrentSetScore().teamA}</span>
                  <span>-</span>
                  <span>{getCurrentSetScore().teamB}</span>
                </div>
              </div>

              <div>
                 <h3 className="text-base sm:text-lg font-semibold mb-1 sm:mb-2 text-muted-foreground">
                  {isTieBreakActive ? t.tieBreakPoints : t.points}
                </h3>
                <div className="flex justify-center items-center gap-1 sm:gap-2 text-3xl sm:text-4xl font-bold">
                  {isTieBreakActive ? (
                    <>
                      <span>{tieBreakScore.teamA}</span>
                      <span>-</span>
                      <span>{tieBreakScore.teamB}</span>
                    </>
                  ) : (
                    <>
                      <span>{currentGameScore.teamA === 'AD' ? 'Ad' : currentGameScore.teamA === 'GAME' ? '0' : currentGameScore.teamA}</span>
                      <span>-</span>
                      <span>{currentGameScore.teamB === 'AD' ? 'Ad' : currentGameScore.teamB === 'GAME' ? '0' : currentGameScore.teamB}</span>
                    </>
                  )}
                </div>
              </div>

              {!matchOver && (
                  <div className="flex flex-col items-center gap-2 mt-auto pt-2 sm:pt-0">
                    <Button onClick={() => updatePoint('teamA', true)} disabled={isUpdatingGame} className="bg-primary hover:bg-primary/90 text-primary-foreground w-full text-xs sm:text-sm h-8 sm:h-9" size="sm">
                      {t.pointTeamA}
                    </Button>
                     <Button onClick={() => updatePoint('teamB', true)} disabled={isUpdatingGame} className="bg-primary hover:bg-primary/90 text-primary-foreground w-full text-xs sm:text-sm h-8 sm:h-9" size="sm">
                      {t.pointTeamB}
                    </Button>
                  </div>
              )}
            </div>


             {!matchOver &&
              <Card className="mt-4 sm:mt-6 bg-card border border-border rounded-lg shadow-md w-full">
                  <CardHeader className="p-3 sm:p-4">
                      <CardTitle className="text-lg sm:text-xl text-center text-card-foreground">{t.teamAStatsCurrentSet}</CardTitle>
                  </CardHeader>
                <CardContent className="grid grid-cols-2 gap-2 px-2 py-3 sm:px-3 sm:py-4">
                  {/* Player 1 Stats */}
                  <div className="space-y-2">
                      <h4 className="text-base sm:text-lg font-semibold text-center text-card-foreground">{teamANames.player1}</h4>
                      <div className="flex items-center justify-between">
                          <span className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1 font-semibold">
                              <Trophy className="w-3 h-3 sm:w-4 sm:h-4 text-green-500" /> {t.totalWinners}
                          </span>
                          <div className="flex items-center gap-1 sm:gap-2">
                               <span className="font-mono text-base sm:text-lg w-5 sm:w-6 text-center font-bold">{teamAStats.player1.winners}</span>
                              <Button onClick={() => undoLastWinner('player1')} variant="outline" size="icon" className="h-6 w-6 sm:h-7 sm:w-7" disabled={!lastWinnerActionPlayer1 || isUpdatingGame}><Undo2 className="h-3 w-3 sm:h-4 sm:w-4" /></Button>
                          </div>
                      </div>
                       <Button
                        onClick={() => updateStat('player1', 'winners', true)}
                        variant="outline"
                        size="sm"
                        className="border-green-500 text-green-500 hover:bg-green-500 hover:text-primary-foreground w-full text-xs sm:text-sm"
                        disabled={isUpdatingGame}
                      >
                        {t.pointButtonLabel}
                      </Button>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-1 sm:gap-2">
                           <Button onClick={() => updateStat('player1', 'x3', true)} variant="outline" size="sm" className="text-xs sm:text-sm justify-start gap-1 border border-primary" disabled={isUpdatingGame}>
                               <Zap className="w-3 h-3 text-yellow-500" /> {t.x3} <span className="ml-auto font-mono">({teamAStats.player1.x3})</span>
                           </Button>
                           <Button onClick={() => updateStat('player1', 'x4', true)} variant="outline" size="sm" className="text-xs sm:text-sm justify-start gap-1 border border-primary" disabled={isUpdatingGame}>
                               <Zap className="w-3 h-3 text-orange-500" /> {t.x4} <span className="ml-auto font-mono">({teamAStats.player1.x4})</span>
                           </Button>
                           <Button onClick={() => updateStat('player1', 'dropshot', true)} variant="outline" size="sm" className="text-xs sm:text-sm justify-start gap-1 border border-primary" disabled={isUpdatingGame}>
                               <Feather className="w-3 h-3 text-blue-500" /> {t.dropshot} <span className="ml-auto font-mono">({teamAStats.player1.dropshot})</span>
                           </Button>
                           <Button onClick={() => updateStat('player1', 'volley', true)} variant="outline" size="sm" className="text-xs sm:text-sm justify-start gap-1 border border-primary" disabled={isUpdatingGame}>
                               <ShieldCheck className="w-3 h-3 text-purple-500" /> {t.volley} <span className="ml-auto font-mono">({teamAStats.player1.volley})</span>
                           </Button>
                      </div>
                      <Separator className="my-2 sm:my-3 border-t" />
                        <Button
                            onClick={() => updateStat('player1', 'errors', true)}
                            variant="outline"
                            size="sm"
                            className="border-red-500 text-red-500 hover:bg-red-500 hover:text-black w-full text-xs sm:text-sm mb-2"
                            disabled={isUpdatingGame}
                        >
                            {t.errorButtonLabel}
                        </Button>
                        <div className="flex items-center justify-between">
                            <span className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1 font-semibold">
                                <CircleOff className="w-3 h-3 sm:w-4 sm:h-4 text-red-500" /> {t.errors}
                            </span>
                            <div className="flex items-center gap-1 sm:gap-2">
                                <span className="font-mono text-base sm:text-lg w-5 sm:w-6 text-center font-bold">{teamAStats.player1.errors}</span>
                                <Button onClick={() => updateStat('player1', 'errors', false)} variant="outline" size="icon" className="h-6 w-6 sm:h-7 sm:w-7" disabled={teamAStats.player1.errors === 0 || isUpdatingGame}><Undo2 className="h-3 w-3 sm:h-4 sm:w-4" /></Button>
                            </div>
                        </div>
                  </div>

                  {/* Player 2 Stats */}
                   <div className="space-y-2">
                      <h4 className="text-base sm:text-lg font-semibold text-center text-card-foreground">{teamANames.player2}</h4>
                       <div className="flex items-center justify-between">
                           <span className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1 font-semibold">
                               <Trophy className="w-3 h-3 sm:w-4 sm:h-4 text-green-500" /> {t.totalWinners}
                          </span>
                           <div className="flex items-center gap-1 sm:gap-2">
                               <span className="font-mono text-base sm:text-lg w-5 sm:w-6 text-center font-bold">{teamAStats.player2.winners}</span>
                               <Button onClick={() => undoLastWinner('player2')} variant="outline" size="icon" className="h-6 w-6 sm:h-7 sm:w-7" disabled={!lastWinnerActionPlayer2 || isUpdatingGame}><Undo2 className="h-3 w-3 sm:h-4 sm:w-4" /></Button>
                          </div>
                       </div>
                       <Button
                        onClick={() => updateStat('player2', 'winners', true)}
                        variant="outline"
                        size="sm"
                        className="border-green-500 text-green-500 hover:bg-green-500 hover:text-primary-foreground w-full text-xs sm:text-sm"
                        disabled={isUpdatingGame}
                      >
                        {t.pointButtonLabel}
                      </Button>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-1 sm:gap-2">
                           <Button onClick={() => updateStat('player2', 'x3', true)} variant="outline" size="sm" className="text-xs sm:text-sm justify-start gap-1 border border-primary" disabled={isUpdatingGame}>
                               <Zap className="w-3 h-3 text-yellow-500" /> {t.x3} <span className="ml-auto font-mono">({teamAStats.player2.x3})</span>
                           </Button>
                           <Button onClick={() => updateStat('player2', 'x4', true)} variant="outline" size="sm" className="text-xs sm:text-sm justify-start gap-1 border border-primary" disabled={isUpdatingGame}>
                               <Zap className="w-3 h-3 text-orange-500" /> {t.x4} <span className="ml-auto font-mono">({teamAStats.player2.x4})</span>
                           </Button>
                           <Button onClick={() => updateStat('player2', 'dropshot', true)} variant="outline" size="sm" className="text-xs sm:text-sm justify-start gap-1 border border-primary" disabled={isUpdatingGame}>
                               <Feather className="w-3 h-3 text-blue-500" /> {t.dropshot} <span className="ml-auto font-mono">({teamAStats.player2.dropshot})</span>
                           </Button>
                           <Button onClick={() => updateStat('player2', 'volley', true)} variant="outline" size="sm" className="text-xs sm:text-sm justify-start gap-1 border border-primary" disabled={isUpdatingGame}>
                               <ShieldCheck className="w-3 h-3 text-purple-500" /> {t.volley} <span className="ml-auto font-mono">({teamAStats.player2.volley})</span>
                           </Button>
                      </div>
                       <Separator className="my-2 sm:my-3 border-t" />
                        <Button
                            onClick={() => updateStat('player2', 'errors', true)}
                            variant="outline"
                            size="sm"
                            className="border-red-500 text-red-500 hover:bg-red-500 hover:text-black w-full text-xs sm:text-sm mb-2"
                            disabled={isUpdatingGame}
                        >
                            {t.errorButtonLabel}
                        </Button>
                        <div className="flex items-center justify-between">
                            <span className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1 font-semibold">
                                <CircleOff className="w-3 h-3 sm:w-4 sm:h-4 text-red-500" /> {t.errors}
                            </span>
                            <div className="flex items-center gap-1 sm:gap-2">
                                <span className="font-mono text-base sm:text-lg w-5 sm:w-6 text-center font-bold">{teamAStats.player2.errors}</span>
                                <Button onClick={() => updateStat('player2', 'errors', false)} variant="outline" size="icon" className="h-6 w-6 sm:h-7 sm:w-7" disabled={teamAStats.player2.errors === 0 || isUpdatingGame}><Undo2 className="h-3 w-3 sm:h-4 sm:w-4" /></Button>
                            </div>
                        </div>
                  </div>
                </CardContent>
              </Card>
            }

              <div className="mt-6 sm:mt-8 flex flex-wrap justify-center gap-2">
                   <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
                      <Button onClick={() => setShowResetDialog(true)} variant="destructive" className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                           {t.resetMatch}
                      </Button>
                      <AlertDialogContent>
                          <AlertDialogHeader>
                          <AlertDialogTitle>{t.confirmResetTitle}</AlertDialogTitle>
                          <AlertDialogDescription>
                              {t.confirmResetDescription}
                          </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                          <AlertDialogCancel onClick={() => setShowResetDialog(false)}>{t.cancel}</AlertDialogCancel>
                          <AlertDialogAction onClick={resetMatch} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">{t.dialogResetMatch}</AlertDialogAction>
                          </AlertDialogFooter>
                      </AlertDialogContent>
                  </AlertDialog>
                  <Button onClick={() => setShowFinalSummaryDetails(prev => !prev)} variant="outline">
                      {showFinalSummaryDetails ? t.hideSummaryDetails : t.showSummaryDetails}
                  </Button>
              </div>
          </CardContent>
        </Card>

        <AlertDialog open={showSetSummary} onOpenChange={setShowSetSummary}>
           <AlertDialogContent className="w-[90vw] max-w-5xl">
              <AlertDialogHeader>
                 <AlertDialogTitle>
                  {matchScore[currentSetIndex] ?
                      t.setSummaryTitle
                          .replace('{setNumber}', (currentSetIndex + 1).toString())
                          .replace('{scoreTeamA}', matchScore[currentSetIndex].teamA.toString())
                          .replace('{scoreTeamB}', matchScore[currentSetIndex].teamB.toString())
                  : t.setSummaryTitle.replace('{setNumber}', (currentSetIndex + 1).toString()).replace('{scoreTeamA}', '0').replace('{scoreTeamA}', '0')
                  }
                 </AlertDialogTitle>
              </AlertDialogHeader>
               <Table>
                  <TableHeader>
                      <TableRow>
                      <TableHead className="text-xs sm:text-sm px-1">{t.player}</TableHead>
                      <TableHead className="text-right text-xs sm:text-sm px-1">{t.winners}</TableHead>
                      <TableHead className="text-right text-xs sm:text-sm px-1">{t.errors}</TableHead>
                      <TableHead className="text-right text-xs sm:text-sm px-1">{t.tableX3}</TableHead>
                      <TableHead className="text-right text-xs sm:text-sm px-1">{t.tableX4}</TableHead>
                      <TableHead className="text-right text-xs sm:text-sm px-1">{t.tableDropshot}</TableHead>
                      <TableHead className="text-right text-xs sm:text-sm px-1">{t.tableVolley}</TableHead>
                      </TableRow>
                  </TableHeader>
                  <TableBody>
                      <TableRow>
                          <TableCell className="font-medium text-xs sm:text-sm px-1 py-2">{teamANames.player1}</TableCell>
                          <TableCell className="text-right text-xs sm:text-sm px-1 py-2">{currentSetStatsSummary.player1.winners}</TableCell>
                          <TableCell className="text-right text-xs sm:text-sm px-1 py-2">{currentSetStatsSummary.player1.errors}</TableCell>
                          <TableCell className="text-right text-xs sm:text-sm px-1 py-2">{currentSetStatsSummary.player1.x3}</TableCell>
                          <TableCell className="text-right text-xs sm:text-sm px-1 py-2">{currentSetStatsSummary.player1.x4}</TableCell>
                          <TableCell className="text-right text-xs sm:text-sm px-1 py-2">{currentSetStatsSummary.player1.dropshot}</TableCell>
                          <TableCell className="text-right text-xs sm:text-sm px-1 py-2">{currentSetStatsSummary.player1.volley}</TableCell>
                      </TableRow>
                      <TableRow>
                          <TableCell className="font-medium text-xs sm:text-sm px-1 py-2">{teamANames.player2}</TableCell>
                          <TableCell className="text-right text-xs sm:text-sm px-1 py-2">{currentSetStatsSummary.player2.winners}</TableCell>
                          <TableCell className="text-right text-xs sm:text-sm px-1 py-2">{currentSetStatsSummary.player2.errors}</TableCell>
                          <TableCell className="text-right text-xs sm:text-sm px-1 py-2">{currentSetStatsSummary.player2.x3}</TableCell>
                          <TableCell className="text-right text-xs sm:text-sm px-1 py-2">{currentSetStatsSummary.player2.x4}</TableCell>
                          <TableCell className="text-right text-xs sm:text-sm px-1 py-2">{currentSetStatsSummary.player2.dropshot}</TableCell>
                          <TableCell className="text-right text-xs sm:text-sm px-1 py-2">{currentSetStatsSummary.player2.volley}</TableCell>
                      </TableRow>
                       <TableRow className="font-semibold bg-muted/50">
                          <TableCell className="text-xs sm:text-sm px-1 py-2">{t.total}</TableCell>
                          <TableCell className="text-right text-xs sm:text-sm px-1 py-2">{currentSetStatsSummary.player1.winners + currentSetStatsSummary.player2.winners}</TableCell>
                          <TableCell className="text-right text-xs sm:text-sm px-1 py-2">{currentSetStatsSummary.player1.errors + currentSetStatsSummary.player2.errors}</TableCell>
                          <TableCell className="text-right text-xs sm:text-sm px-1 py-2">{currentSetStatsSummary.player1.x3 + currentSetStatsSummary.player2.x3}</TableCell>
                          <TableCell className="text-right text-xs sm:text-sm px-1 py-2">{currentSetStatsSummary.player1.x4 + currentSetStatsSummary.player2.x4}</TableCell>
                          <TableCell className="text-right text-xs sm:text-sm px-1 py-2">{currentSetStatsSummary.player1.dropshot + currentSetStatsSummary.player2.dropshot}</TableCell>
                          <TableCell className="text-right text-xs sm:text-sm px-1 py-2">{currentSetStatsSummary.player1.volley + currentSetStatsSummary.player2.volley}</TableCell>
                      </TableRow>
                  </TableBody>
              </Table>
              <AlertDialogFooter>
                  <AlertDialogAction onClick={closeSetSummary} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                     {matchOver ? t.viewFinalSummary : t.startNextSet}
                 </AlertDialogAction>
              </AlertDialogFooter>
           </AlertDialogContent>
         </AlertDialog>

        {showFinalSummaryDetails && (
           <Card className="w-full mt-4 shadow-lg border border-border rounded-lg" data-summary-card>
             <CardHeader className="text-center bg-primary text-primary-foreground p-4 rounded-t-lg">
               <CardTitle className="text-xl sm:text-2xl font-bold">{t.matchSummaryTitle}</CardTitle>
             </CardHeader>
              <CardContent className="p-3 sm:p-6" ref={summaryRef}>
                  <div className="flex justify-center items-center gap-2 sm:gap-4 text-xl sm:text-2xl font-bold mb-4 sm:mb-6">
                      <span>{t.finalScoreTeamA.replace('{score}', summaryCardTeamASetsWon.toString())}</span>
                      <span>-</span>
                      <span>{t.finalScoreTeamB.replace('{score}', summaryCardTeamBSetsWon.toString())}</span>
                  </div>
                  <div className="text-center text-muted-foreground mb-4 sm:mb-6">
                      {summaryCardMatchData.map((set, index) => {
                          const currentSetScore = getCurrentSetScore(); 
                          if (index > currentSetIndex && (set.teamA === 0 && set.teamB === 0)) {
                              return null;
                          }
                           if (index === currentSetIndex && (currentSetScore.teamA === 0 && currentSetScore.teamB === 0 && currentGameScore.teamA === '0' && currentGameScore.teamB === '0' && !isTieBreakActive) && summaryCardMatchData.length > 1 && index > 0 ) {
                               if(index > 0 && (summaryCardMatchData[index-1].teamA > 0 || summaryCardMatchData[index-1].teamB > 0)) return null;

                           }
                          const isSupertiebreakDisplay = matchFormat === 'supertiebreak' && index === 2 && (set.teamA === 1 || set.teamB === 1);
                          return (
                              <span key={`final-set-score-${index}`} className="mr-2 text-base sm:text-lg">
                                  {set.teamA}-{set.teamB}
                                  {( (set.teamA === 7 || set.teamB === 7) && !(matchFormat === 'supertiebreak' && index ===2) || isSupertiebreakDisplay) ? ` (${t.tieBreakShort})` : ''}
                              </span>
                          );
                      })}
                  </div>
                  {summaryCardStatsData.length > 0 ? (
                      <Table>
                          <TableHeader>
                              <TableRow>
                              <TableHead className="text-xs sm:text-sm px-1">{t.set}</TableHead>
                              <TableHead className="text-xs sm:text-sm px-1">{t.player}</TableHead>
                              <TableHead className="text-center text-xs sm:text-sm px-1">{t.winners}</TableHead>
                              <TableHead className="text-center text-xs sm:text-sm px-1">{t.errors}</TableHead>
                              <TableHead className="text-center text-xs sm:text-sm px-1">{t.tableX3}</TableHead>
                              <TableHead className="text-center text-xs sm:text-sm px-1">{t.tableX4}</TableHead>
                              <TableHead className="text-center text-xs sm:text-sm px-1">{t.tableDropshot}</TableHead>
                              <TableHead className="text-center text-xs sm:text-sm px-1">{t.tableVolley}</TableHead>
                              </TableRow>
                          </TableHeader>
                          <TableBody>
                          {summaryCardStatsData.map((setStat, setIndex) => {
                              const setScoreForDisplay = summaryCardMatchData[setIndex] || initialSetScore;
                              if (!matchOver && setIndex === summaryCardStatsData.length - 1) { 
                                  const player1Empty = Object.values(setStat.player1).every(v => v === 0);
                                  const player2Empty = Object.values(setStat.player2).every(v => v === 0);
                                  const isSupertiebreakSetInProgress = matchFormat === 'supertiebreak' && setIndex === 2 && isTieBreakActive;

                                  if (player1Empty && player2Empty && (setScoreForDisplay.teamA === 0 && setScoreForDisplay.teamB === 0) && summaryCardStatsData.length > 1 && !isSupertiebreakSetInProgress) {
                                      return null;
                                  }
                              }

                              return (
                              <React.Fragment key={`summary-card-set-stats-${setIndex}`}>
                              <TableRow>
                                  <TableCell rowSpan={3} className="font-medium align-top pt-2 sm:pt-4 border-r text-xs sm:text-sm px-1 py-2">
                                      {(setIndex + 1).toString()}
                                      {((setScoreForDisplay.teamA === 7 || setScoreForDisplay.teamB === 7) || (matchFormat === 'supertiebreak' && setIndex === 2)) ? ` (${t.tieBreakShort})` : ''}
                                  </TableCell>
                                  <TableCell className="text-xs sm:text-sm px-1 py-2">{teamANames.player1}</TableCell>
                                  <TableCell className="text-center text-xs sm:text-sm px-1 py-2">{setStat.player1.winners}</TableCell>
                                  <TableCell className="text-center text-xs sm:text-sm px-1 py-2">{setStat.player1.errors}</TableCell>
                                  <TableCell className="text-center text-xs sm:text-sm px-1 py-2">{setStat.player1.x3}</TableCell>
                                  <TableCell className="text-center text-xs sm:text-sm px-1 py-2">{setStat.player1.x4}</TableCell>
                                  <TableCell className="text-center text-xs sm:text-sm px-1 py-2">{setStat.player1.dropshot}</TableCell>
                                  <TableCell className="text-center text-xs sm:text-sm px-1 py-2">{setStat.player1.volley}</TableCell>
                              </TableRow>
                              <TableRow>
                                  <TableCell className="text-xs sm:text-sm px-1 py-2">{teamANames.player2}</TableCell>
                                  <TableCell className="text-center text-xs sm:text-sm px-1 py-2">{setStat.player2.winners}</TableCell>
                                  <TableCell className="text-center text-xs sm:text-sm px-1 py-2">{setStat.player2.errors}</TableCell>
                                  <TableCell className="text-center text-xs sm:text-sm px-1 py-2">{setStat.player2.x3}</TableCell>
                                  <TableCell className="text-center text-xs sm:text-sm px-1 py-2">{setStat.player2.x4}</TableCell>
                                  <TableCell className="text-center text-xs sm:text-sm px-1 py-2">{setStat.player2.dropshot}</TableCell>
                                  <TableCell className="text-center text-xs sm:text-sm px-1 py-2">{setStat.player2.volley}</TableCell>
                              </TableRow>
                                  <TableRow className="font-semibold bg-muted/50 border-b-2 border-border">
                                      <TableCell className="text-xs sm:text-sm px-1 py-2">{t.setTotal}</TableCell>
                                      <TableCell className="text-center text-xs sm:text-sm px-1 py-2">{setStat.player1.winners + setStat.player2.winners}</TableCell>
                                      <TableCell className="text-center text-xs sm:text-sm px-1 py-2">{setStat.player1.errors + setStat.player2.errors}</TableCell>
                                      <TableCell className="text-center text-xs sm:text-sm px-1 py-2">{setStat.player1.x3 + setStat.player2.x3}</TableCell>
                                      <TableCell className="text-center text-xs sm:text-sm px-1 py-2">{setStat.player1.x4 + setStat.player2.x4}</TableCell>
                                      <TableCell className="text-center text-xs sm:text-sm px-1 py-2">{setStat.player1.dropshot + setStat.player2.dropshot}</TableCell>
                                      <TableCell className="text-center text-xs sm:text-sm px-1 py-2">{setStat.player1.volley + setStat.player2.volley}</TableCell>
                                  </TableRow>
                              </React.Fragment>
                          )})}
                              <TableRow className="font-bold text-sm sm:text-lg bg-primary/10">
                                  <TableCell colSpan={2} className="text-xs sm:text-sm px-1 py-2">{t.matchTotals}</TableCell>
                                  <TableCell className="text-center text-xs sm:text-sm px-1 py-2">
                                      {summaryCardStatsData.reduce((acc, curr) => acc + curr.player1.winners + curr.player2.winners, 0)}
                                  </TableCell>
                                  <TableCell className="text-center text-xs sm:text-sm px-1 py-2">
                                      {summaryCardStatsData.reduce((acc, curr) => acc + curr.player1.errors + curr.player2.errors, 0)}
                                  </TableCell>
                                  <TableCell className="text-center text-xs sm:text-sm px-1 py-2">
                                      {summaryCardStatsData.reduce((acc, curr) => acc + curr.player1.x3 + curr.player2.x3, 0)}
                                  </TableCell>
                                  <TableCell className="text-center text-xs sm:text-sm px-1 py-2">
                                      {summaryCardStatsData.reduce((acc, curr) => acc + curr.player1.x4 + curr.player2.x4, 0)}
                                  </TableCell>
                                  <TableCell className="text-center text-xs sm:text-sm px-1 py-2">
                                      {summaryCardStatsData.reduce((acc, curr) => acc + curr.player1.dropshot + curr.player2.dropshot, 0)}
                                  </TableCell>
                                  <TableCell className="text-center text-xs sm:text-sm px-1 py-2">
                                      {summaryCardStatsData.reduce((acc, curr) => acc + curr.player1.volley + curr.player2.volley, 0)}
                                  </TableCell>
                          </TableRow>
                          </TableBody>
                      </Table>
                  ) : (
                       <p className="text-center text-muted-foreground py-4">{matchOver ? t.matchFinished : t.noStatsYet}</p>
                  )}
              </CardContent>
              <CardContent className="p-3 sm:p-6 pt-0 flex flex-col items-stretch sm:flex-row sm:justify-center sm:items-center gap-2 sm:gap-4">
                  <Button onClick={handleShareSummary} variant="outline" disabled={isSharing || summaryCardStatsData.length === 0}>
                      {isSharing ? (
                      <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {t.sharing}
                      </>
                      ) : (
                      <>
                          <Share2 className="mr-2 h-4 w-4" />
                          {t.shareSummary}
                      </>
                      )}
                  </Button>
                  <Button onClick={exportSummaryToCSV} variant="outline" disabled={summaryCardStatsData.length === 0}>
                      <Download className="mr-2 h-4 w-4" />
                      {t.exportCSV}
                  </Button>
              </CardContent>
           </Card>
         )}
      </div>
      <AppNavigation />
    </>
  );
}
