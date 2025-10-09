import { useId, useState } from 'react';
import type {
  GameResultSummary,
  HandScoreSummary,
  Phase,
  PlayerId,
  TeamId,
} from '@hooker/shared';
import { HAND_TRICK_COUNT, MATCH_GAME_TARGET, PLAYERS } from '@hooker/shared';

type NamedPlayer = {
  id: PlayerId;
  name: string;
};

type ScoreboardTeam = {
  id: TeamId;
  label: string;
  members: NamedPlayer[];
  handTricks: number;
};

type MatchRotationTeam = {
  id: TeamId;
  label: string;
  members: NamedPlayer[];
};

type MatchRotationEntry = {
  gameIndex: number;
  seating: PlayerId[];
  teams: MatchRotationTeam[];
};

interface ScoreboardProps {
  scores: Record<TeamId, number>;
  teams: ScoreboardTeam[];
  dealer: PlayerId;
  dealerName: string;
  trickIndex: number;
  lastHandSummary?: HandScoreSummary;
  match: {
    phase: Phase;
    gameIndex: number;
    results: GameResultSummary[];
    rotation: MatchRotationEntry[];
    playerNames: Record<PlayerId, string>;
    playerGameWins: Record<PlayerId, number>;
  };
}

function teamLabel(team: TeamId) {
  return team === 'NorthSouth' ? 'North / South' : 'East / West';
}

function formatLastHand(summary: HandScoreSummary | undefined) {
  if (!summary) return null;
  const euchred = summary.euchred ? ' • Euchred' : '';
  return `Last hand: ${teamLabel(summary.winningTeam)} +${summary.points}${euchred}`;
}

function formatMembers(members: NamedPlayer[]) {
  return members.map((member) => `${member.name} (${member.id})`).join(' & ');
}

function formatScore(score: Record<TeamId, number>) {
  return `${score.NorthSouth}-${score.EastWest}`;
}

export function Scoreboard({
  scores,
  teams,
  dealer,
  dealerName,
  trickIndex,
  lastHandSummary,
  match,
}: ScoreboardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const detailsId = useId();
  const lastHandText = formatLastHand(lastHandSummary);
  const tricksCompleted = trickIndex;
  const currentHandStatus = `Tricks completed: ${tricksCompleted} / ${HAND_TRICK_COUNT}`;
  const resultsByIndex = new Map(match.results.map((result) => [result.gameIndex, result]));
  const totalGames = match.rotation.length;
  const currentGameIndex = Math.min(match.gameIndex, totalGames - 1);
  const matchTitle =
    match.phase === 'MatchOver'
      ? 'Match Complete'
      : `Match Game ${currentGameIndex + 1} of ${totalGames}`;

  const matchGames = match.rotation.map((entry) => {
    const result = resultsByIndex.get(entry.gameIndex);
    let status: 'completed' | 'active' | 'upcoming' = 'upcoming';
    if (match.phase === 'MatchOver' || result || entry.gameIndex < match.gameIndex) {
      status = 'completed';
    } else if (entry.gameIndex === match.gameIndex) {
      status = 'active';
    }
    return { ...entry, result, status };
  });

  const honors: Array<{ label: string; players: NamedPlayer[] }> = [];
  if (match.phase === 'MatchOver') {
    const wins = match.playerGameWins;
    const talson = PLAYERS.filter((player) => wins[player] === totalGames).map((player) => ({
      id: player,
      name: match.playerNames[player] ?? player,
    }));
    const usha = PLAYERS.filter((player) => wins[player] === 0).map((player) => ({
      id: player,
      name: match.playerNames[player] ?? player,
    }));
    if (talson.length > 0) {
      honors.push({ label: 'Talson', players: talson });
    }
    if (usha.length > 0) {
      honors.push({ label: 'Usha', players: usha });
    }
  }

  const toggleLabel = isExpanded ? 'Hide Details' : 'Show Details';
  const toggleIcon = isExpanded ? '▴' : '▾';

  return (
    <section className="scoreboard" aria-label="Scoreboard">
      <header className="scoreboard-header">
        <div className="scoreboard-match-header">
          <h2 className="scoreboard-title">{matchTitle}</h2>
          <span className="scoreboard-target" aria-live="polite">
            Game to {MATCH_GAME_TARGET}
          </span>
        </div>
        <p className="scoreboard-subtitle" role="status" aria-live="polite">
          {currentHandStatus}
        </p>
        <p className="scoreboard-dealer" role="status" aria-live="polite">
          Dealer: <span className="scoreboard-dealer-name">{dealerName}</span> ({dealer})
        </p>
        {lastHandText ? <p className="scoreboard-last-hand">{lastHandText}</p> : null}
      </header>

      <div className="scoreboard-summary" aria-live="polite">
        <h3 className="scoreboard-section-title scoreboard-summary-title">Match Score</h3>
        <ul className="scoreboard-summary-list">
          {teams.map((team) => {
            const score = scores[team.id] ?? 0;
            return (
              <li key={team.id} className="scoreboard-summary-item">
                <span className="scoreboard-summary-label">{team.label}</span>
                <span className="scoreboard-summary-score">
                  {score}
                  <span aria-hidden="true" className="scoreboard-summary-target">
                    /{MATCH_GAME_TARGET}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="scoreboard-toggle-wrapper">
        <button
          type="button"
          className="scoreboard-toggle"
          onClick={() => setIsExpanded((current) => !current)}
          aria-expanded={isExpanded}
          aria-controls={detailsId}
        >
          <span className="scoreboard-toggle-text">{toggleLabel}</span>
          <span aria-hidden="true" className="scoreboard-toggle-icon">
            {toggleIcon}
          </span>
        </button>
      </div>

      <div
        id={detailsId}
        className={`scoreboard-details${isExpanded ? ' scoreboard-details--expanded' : ''}`}
        aria-hidden={!isExpanded}
      >
        <div className="scoreboard-match-summary" aria-live="polite">
          <h3 className="scoreboard-section-title">Match Rotation</h3>
          <ol className="scoreboard-match-list">
            {matchGames.map((game) => (
              <li
                key={game.gameIndex}
                className={`scoreboard-match-item scoreboard-match-item--${game.status}`}
              >
                <div className="scoreboard-match-item-header">
                  <span className="scoreboard-match-item-label">Game {game.gameIndex + 1}</span>
                  {game.result ? (
                    <span className="scoreboard-match-item-result">
                      {teamLabel(game.result.winner)} won {formatScore(game.result.scores)}
                    </span>
                  ) : (
                    <span className="scoreboard-match-item-status">{game.status}</span>
                  )}
                </div>
                <div className="scoreboard-match-item-teams">
                  {game.teams.map((team) => (
                    <div key={team.id} className="scoreboard-match-team">
                      <span className="scoreboard-match-team-label">{team.label}:</span>{' '}
                      <span className="scoreboard-match-team-members">{formatMembers(team.members)}</span>
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </ol>
        </div>

        {honors.length > 0 ? (
          <div className="scoreboard-honors" aria-live="polite">
            <h3 className="scoreboard-section-title">Honors</h3>
            <ul className="scoreboard-honors-list">
              {honors.map((entry) => (
                <li key={entry.label} className="scoreboard-honor">
                  <span className="scoreboard-honor-label">{entry.label}:</span>{' '}
                  <span className="scoreboard-honor-players">{formatMembers(entry.players)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <ul className="scoreboard-list">
          {teams.map((team) => {
            const score = scores[team.id] ?? 0;
            return (
              <li key={team.id} className="scoreboard-team" aria-label={`Team ${team.label}`}>
                <div className="scoreboard-team-header">
                  <span className="scoreboard-team-label">{team.label}</span>
                  <span className="scoreboard-team-score" aria-live="polite">
                    {score}
                    <span className="scoreboard-team-target" aria-hidden="true">
                      /{MATCH_GAME_TARGET}
                    </span>
                  </span>
                </div>
                <div className="scoreboard-team-members">{formatMembers(team.members)}</div>
                <div className="scoreboard-team-tricks" role="status" aria-live="polite">
                  Tricks this hand: {team.handTricks}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

export default Scoreboard;
