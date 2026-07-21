
# Padel Counter Blueprint

This document outlines the core requirements and the evolution of the Padel Counter application.

## 1. Original User Request

The initial request for the application was:

> Una aplicación que me permita llevar el contador de un partido de padel.
> La aplicación debe resgistrar el total de sets, juegos y puntos del partido.
> La aplicación debe permitir tener las estadísticas de puntos ganadores y de errores de una de las dos parejas que juegan.
> Al final de cada set se deben mostrar las estadisticas de cada jugador.
> Al final del partido se deben guardar el resultado del partido y las estadisticas de cada jugador.

## 2. Implemented Features & Enhancements

Based on the original request and subsequent development iterations, the following features have been implemented:

*   **Core Score Tracking**:
    *   Tracks points (0, 15, 30, 40, AD, Game).
        *   Includes "Golden Point" logic: If enabled in settings, when the score is 40-40, the next point wins the game (no AD).
    *   Tracks games per set.
    *   Tracks sets per match.
        *   Default format: Best of 3 sets to win (first to 2 sets).
        *   Supports "Supertiebreak to 10" format: If enabled in settings and sets are tied 1-1, the third deciding "set" is a supertiebreak played to 10 points (must win by 2). The set score for this supertiebreak is recorded as 1-0 for the winner.
    *   Includes Tie-Break scoring logic (points 1, 2, 3... winning at 7 with a 2-point difference, or continuing if not) when a set reaches 6-6 in games (this applies to standard sets, not the deciding supertiebreak set if that format is chosen).
*   **Statistics Tracking (for one team - "Team A")**:
    *   Editable names for the two players of Team A.
    *   Tracks Winners:
        *   General winners.
        *   Specific winner types: x3, x4, Dropshot, Volley.
    *   Tracks Errors.
    *   Functionality to undo the last registered winner or error for Team A players.
*   **Match Progression & Summaries**:
    *   Displays current set score, game score, and overall match set score.
    *   Shows a summary of Team A's statistics at the end of each set, including the set score.
    *   Displays a final match summary card (toggleable visibility during the match), including all set scores (indicating tie-breaks or supertiebreaks where applicable) and aggregated Team A statistics per set and for the entire match. This summary reflects live data if viewed mid-match.
*   **User Interface & Experience**:
    *   Bilingual support: English and Spanish, with a toggle in the settings menu.
    *   Settings Panel: Accessible via a settings icon in the header, containing:
        *   Language toggle.
        *   Option to edit Team A player names (can be restricted based on match state).
        *   Checkbox to enable/disable "Golden Point" scoring (can be restricted based on match state).
        *   Radio group to select match format: "Best of 3 Sets" or "Supertiebreak to 10" (can be restricted based on match state).
    *   Responsive design adjustments for improved usability on various screen sizes, especially mobile devices, aiming to minimize vertical scrolling for primary game interface.
    *   Clear visual distinction for different UI elements (score, stats, controls).
    *   Custom application title ("Padel BI") and favicon.
*   **Match Controls**:
    *   Buttons to award points to "Team A" (the tracked team) or "Team B" (the opponent). Point awards to Team A are triggered by specific stat buttons; point awards for Team A errors are given to Team B.
    *   Detailed stat input buttons (x3, x4, Dropshot, Volley, general Winner, Error) for Team A players.
    *   Match Reset: Allows resetting the entire match score, statistics, team names, and match settings (Golden Point, Match Format).
*   **Sharing**:
    *   "Share Summary" button on the final match summary card to share an image of the results (uses the Web Share API with improved styling for shared image).

## 3. Enhancements from Current Development Cycle

The following features are part of the current development focus, based on recent requests:

*   **Statistics for Both Teams**: Extend detailed statistics tracking (winners, errors, specific shot types) to the opposing team (Team B). (This is a pending request from the PRD update).
*   **Persistent Match Storage**: Implement a mechanism to save match results and detailed statistics (for one or both teams) locally or to a backend, allowing users to review past matches. (This is a pending request from the PRD update).
*   **Refined Team Name Editing**: Allow editing names for both teams if stats for both teams are tracked.
*   **Comprehensive Match Reset**: Ensure the reset functionality covers all new aspects like stats for both teams if implemented.

This document will be updated as the application evolves.

    