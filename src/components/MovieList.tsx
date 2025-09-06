import type { Movie } from '../interfaces';
import MovieItem from './MovieItem';
import { USERS } from '../App';

interface MovieListProps {
  movies: Movie[];
  submittedVotes: string[];
  tieBreakerUser: string | null;
  onAddRating: (id: string, rating: number) => void;
  onRemoveRating: (movieId: string) => void;
  onSubmitVotes: () => void;
  currentUser: string;
  areSubmissionsComplete: boolean;
  areAllVotesSubmitted: boolean;
  winner: Movie | null;
  absentUsers: string[];
  activePrimaryUsers: string[];
}

export default function MovieList({ movies, submittedVotes, tieBreakerUser, onAddRating, onRemoveRating, onSubmitVotes, currentUser, areSubmissionsComplete, winner, absentUsers, activePrimaryUsers }: MovieListProps) {
  const userVotes = movies.map(movie => movie.ratings[currentUser]).filter(Boolean);
  const allUserIds = Object.keys(USERS);

  const canUserSubmitVotes = movies.length > 0 && userVotes.length === movies.length;
  const hasUserSubmittedVotes = submittedVotes.includes(currentUser);
  
  const pendingVoters = activePrimaryUsers.filter(id => !submittedVotes.includes(id));

  const sortedMovies = [...movies].sort((a, b) => {
    if (winner) {
      return a.averageRating - b.averageRating; // Sort ascending (lowest first)
    }
    if (areSubmissionsComplete) {
      return a.title.localeCompare(b.title);
    }
    return 0;
  });

  return (
    <div className="movie-list">
      {!areSubmissionsComplete ? (
        <div className="submission-status">
          <h2>Waiting for Submissions...</h2>
          <ul className="status-list">
            {allUserIds.map(userId => {
              const hasSubmitted = new Set(movies.map(m => m.submittedBy)).has(userId);
              const isAbsent = absentUsers.includes(userId);
              const statusClass = isAbsent ? 'status-absent' : (hasSubmitted ? 'status-submitted' : 'status-pending');
              return (
                <li key={userId} className={`status-item ${statusClass}`}>
                  <span>{USERS[userId].name}</span>
                  <span>{isAbsent ? '🌙 Absent' : (hasSubmitted ? '✅ Submitted' : '❌ Waiting')}</span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <>
          <h2>This Week's Contenders</h2>
          <div className="vote-submission-area">
            {hasUserSubmittedVotes ? (
              <>
                <p className="votes-submitted-message">✅ Your votes are locked in!</p>
                {pendingVoters.length > 0 ? (
                  <div className="pending-voters-list">
                    Waiting for: {pendingVoters.map(id => USERS[id].name).join(', ')}
                  </div>
                ) : (
                  <div className="pending-voters-list">
                    Everyone has voted
                  </div>
                )}
              </>
            ) : (
              <button onClick={onSubmitVotes} disabled={!canUserSubmitVotes}>
                {canUserSubmitVotes ? 'Lock In Your Votes' : 'Assign all ratings to submit'}
              </button>
            )}
          </div>

          {winner && tieBreakerUser && (
            <div className="tie-breaker-message">
              <span>🏆 Tie broken by {tieBreakerUser}'s vote!</span>
            </div>
          )}
          
          
          {!hasUserSubmittedVotes && sortedMovies.map((movie) => (
            <MovieItem
              key={movie.id}
              movie={movie}
              onAddRating={onAddRating}
              onRemoveRating={onRemoveRating}
              currentUser={currentUser}
              userVotes={userVotes}
              areSubmissionsComplete={areSubmissionsComplete}
              hasUserSubmittedVotes={hasUserSubmittedVotes}
              rank={winner ? (winner.id === movie.id ? 1 : undefined) : undefined}
              numberOfMovies={movies.length}
              showFinalScores={false}
            />
          ))}
          
          {hasUserSubmittedVotes && winner && sortedMovies.map((movie) => (
            <MovieItem
              key={movie.id}
              movie={movie}
              onAddRating={onAddRating}
              onRemoveRating={onRemoveRating}
              currentUser={currentUser}
              userVotes={userVotes}
              areSubmissionsComplete={areSubmissionsComplete}
              hasUserSubmittedVotes={hasUserSubmittedVotes}
              rank={winner ? (winner.id === movie.id ? 1 : undefined) : undefined}
              numberOfMovies={movies.length}
              showFinalScores={true}
            />
          ))}
        </>
      )}
    </div>
  );
}