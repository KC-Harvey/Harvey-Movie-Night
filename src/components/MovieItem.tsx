import type { Movie } from '../interfaces';
import { USERS } from '../App';

interface MovieItemProps {
  movie: Movie;
  onAddRating: (id: string, rating: number) => void;
  onRemoveRating: (id:string) => void;
  currentUser: string;
  userVotes: number[];
  areSubmissionsComplete: boolean;
  hasUserSubmittedVotes: boolean;
  rank?: number;
  numberOfMovies: number;
  showFinalScores: boolean;
}

export default function MovieItem({ movie, onAddRating, onRemoveRating, currentUser, userVotes, areSubmissionsComplete, hasUserSubmittedVotes, rank, numberOfMovies, showFinalScores }: MovieItemProps) {
  const currentUserVoteForThisMovie = movie.ratings[currentUser];

  const handleVoteClick = (rating: number) => {
    if (currentUserVoteForThisMovie === rating) {
      onRemoveRating(movie.id);
    } else {
      onAddRating(movie.id, rating);
    }
  };

  const itemClassName = `movie-item ${rank === 1 ? 'winner-item' : ''}`;

  return (
    <div className={itemClassName}>
      <div className="movie-info">
        {rank && <span className="rank-badge">{rank}</span>}
        <h3>{movie.title}</h3>
      </div>
      
      {/* --- This is the corrected line --- */}
      {(!areSubmissionsComplete || showFinalScores) && <p>Submitted by: <strong>{USERS[movie.submittedBy]?.name || 'Unknown'}</strong></p>}
      
      {movie.trailerLink && <a href={movie.trailerLink} target="_blank" rel="noopener noreferrer">Watch Trailer</a>}
      
      <div className="rating">
        {showFinalScores ? (
           <p>Final Score: {movie.averageRating.toFixed(1)}</p>
        ) : (
          <p className="locked-average">
            {!areSubmissionsComplete ? 'Voting is locked' : ''}
          </p>
        )}

        <div className="rating-container">
          <div className="rating-buttons">
            {Array.from({ length: numberOfMovies }, (_, i) => numberOfMovies - i).map((ratingValue) => {
              const isVotedByUser = currentUserVoteForThisMovie === ratingValue;
              const isRatingUsedElsewhere = userVotes.includes(ratingValue) && !isVotedByUser;
              const buttonClass = isVotedByUser ? 'voted-by-user' : '';

              return (
                <button 
                  key={ratingValue} 
                  onClick={() => handleVoteClick(ratingValue)}
                  disabled={isRatingUsedElsewhere || !areSubmissionsComplete || hasUserSubmittedVotes}
                  className={buttonClass}
                >
                  {ratingValue}
                </button>
              );
            })}
          </div>
          <div className="rating-labels">
            <span className="locked-average rating-label-lowest">lowest interest</span>
            <span className="locked-average rating-label-highest">highest interest</span>
          </div>
        </div>
        {currentUserVoteForThisMovie && (
          <p className="vote-receipt">You voted: {currentUserVoteForThisMovie}</p>
        )}
      </div>
    </div>
  );
}