export type PlayerStats = {
  winners: number;
  errors: number;
  x3: number;
  x4: number;
  dropshot: number;
  volley: number;
};

export type TeamStats = { player1: PlayerStats; player2: PlayerStats };

export type SetScore = { teamA: number; teamB: number };

export type SavedMatch = {
  teamANames: { player1: string; player2: string };
  matchScore: SetScore[];
  setStats: TeamStats[];
  matchFormat: 'bestOfThree' | 'supertiebreak';
  isGoldenPoint: boolean;
  teamASetsWon: number;
  teamBSetsWon: number;
};
