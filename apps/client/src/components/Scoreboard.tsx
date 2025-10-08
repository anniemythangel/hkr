import type { HandScoreSummary, PlayerId, TeamId } from '@hooker/shared';

type ScoreboardTeam = {
  id: TeamId;
  label: string;
  members: string[];
  handTricks: number;
};

interface ScoreboardProps {
  scores: Record<TeamId, number>;
  teams: ScoreboardTeam[];
  dealer: PlayerId;
  dealerName: string;
  trickIndex: number;
  lastHandSummary?: HandScoreSummary;
}

function teamLabel(team: TeamId) {
  return team === 'NorthSouth' ? 'North / South' : 'East / West';
}

function formatLastHand(summary: HandScoreSummary | undefined) {
  if (!summary) return null;
  const euchred = summary.euchred ? ' • Euchred' : '';
  return `Last hand: ${teamLabel(summary.winningTeam)} +${summary.points}${euchred}`;
}

export function Scoreboard({
  scores,
  teams,
  dealer,
  dealerName,
  trickIndex,
  lastHandSummary,
}: ScoreboardProps) {
  const lastHandText = formatLastHand(lastHandSummary);
  const tricksCompleted = trickIndex;
  const totalTricks = 5;
  const currentHandStatus = `Tricks completed: ${tricksCompleted} / ${totalTricks}`;

  return (
    <section className="scoreboard" aria-label="Scoreboard">
      <header className="scoreboard-header">
        <h2 className="scoreboard-title">Game to 10</h2>
        <p className="scoreboard-subtitle" role="status" aria-live="polite">
          {currentHandStatus}
        </p>
        <p className="scoreboard-dealer" role="status" aria-live="polite">
          Dealer: <span className="scoreboard-dealer-name">{dealerName}</span> ({dealer})
        </p>
        {lastHandText ? <p className="scoreboard-last-hand">{lastHandText}</p> : null}
      </header>
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
                    /10
                  </span>
                </span>
              </div>
              <div className="scoreboard-team-members">
                {team.members.join(' & ')}
              </div>
              <div className="scoreboard-team-tricks" role="status" aria-live="polite">
                Tricks this hand: {team.handTricks}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default Scoreboard;
