import { useState, useEffect } from 'react';
import type { Movie } from '../interfaces';
import AddMovieForm from '../components/AddMovieForm';
import MovieList from '../components/MovieList';
import AdminControls from '../components/AdminControls';
import Countdown from '../components/Countdown';
import { USERS } from '../App';

interface WeeklyPageProps {
  movies: Movie[];
  submittedVotes: string[];
  tieBreakerUser: string | null;
  onAddMovie: (title: string, trailerLink: string) => void;
  onScrapMovie: () => void;
  onAddRating: (id: string, rating: number) => void;
  onRemoveRating: (movieId: string) => void;
  onSubmitVotes: () => void;
  onEndWeek: (date: string) => void;
  currentUser: string;
  setCurrentUser: (userId: string) => void;
  submissionDeadline: string | null;
  setSubmissionDeadline: (deadline: string) => void;
  areSubmissionsComplete: boolean;
  endSubmissions: () => void;
  isKcAuthenticated: boolean;
  authenticateKc: (pin: string) => boolean;
  winner: Movie | null;
  pickWinner: () => void;
  updateUserAbsence: (userId: string, isAbsent: boolean) => void;
  absentUsers: string[];
  resetUserVote: (userId: string) => Promise<void>;
}

export default function WeeklyPage({
  movies, submittedVotes, tieBreakerUser, onAddMovie, onScrapMovie, onAddRating, onRemoveRating, onSubmitVotes, onEndWeek, currentUser, setCurrentUser, submissionDeadline, setSubmissionDeadline, areSubmissionsComplete, endSubmissions, isKcAuthenticated, authenticateKc, winner, pickWinner, updateUserAbsence, absentUsers, resetUserVote,
}: WeeklyPageProps) {
  const [movieNightDate, setMovieNightDate] = useState(new Date().toISOString().split('T')[0]);

  const submittedMovieUserIds = new Set(movies.map(m => m.submittedBy));
  const activeUsers = Object.keys(USERS).filter(id => !absentUsers.includes(id));
  const activePrimaryUsers = ['user-1', 'user-2', 'user-3', 'user-4', 'user-5'].filter(id => !absentUsers.includes(id));

  const allActiveUsersSubmitted = activeUsers.every(id => submittedMovieUserIds.has(id));
  const isDeadlineReached = submissionDeadline ? new Date() > new Date(submissionDeadline) : false;
  const finalAreSubmissionsComplete = areSubmissionsComplete || allActiveUsersSubmitted || isDeadlineReached;
  
  const areAllVotesSubmitted = activePrimaryUsers.every(id => submittedVotes.includes(id));
  const currentUserSubmission = movies.find(m => m.submittedBy === currentUser);

  useEffect(() => {
    if (isDeadlineReached && !areSubmissionsComplete) {
      endSubmissions();
    }
  }, [isDeadlineReached, areSubmissionsComplete, endSubmissions]);

  const handleUserChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedUserId = e.target.value;
    if (selectedUserId === 'user-3' && !isKcAuthenticated) {
      const pin = prompt('Please enter the PIN for KC:');
      if (pin && authenticateKc(pin)) {
        setCurrentUser(selectedUserId);
      } else {
        alert('Incorrect PIN.');
        e.target.value = currentUser;
      }
    } else {
      setCurrentUser(selectedUserId);
    }
  };

  const handleEndWeek = () => {
    if (!movieNightDate) {
      alert("Please select a date for the movie night.");
      return;
    }
    onEndWeek(movieNightDate);
  };

  return (
    <div className="weekly-page-container">
      <div className="user-selection-area">
        <label htmlFor="user-select">Current User:</label>
        <select id="user-select" value={currentUser} onChange={handleUserChange}>
          {Object.entries(USERS).map(([id, user]) => (
            <option key={id} value={id}>{user.name}</option>
          ))}
        </select>
      </div>

      {currentUser === 'user-3' && isKcAuthenticated && (
        <AdminControls 
          setSubmissionDeadline={setSubmissionDeadline} 
          endSubmissions={endSubmissions}
          updateUserAbsence={updateUserAbsence}
          absentUsers={absentUsers}
          resetUserVote={resetUserVote}
          submittedVotes={submittedVotes}
        />
      )}

      {!finalAreSubmissionsComplete && <Countdown submissionDeadline={submissionDeadline} />}

      {!finalAreSubmissionsComplete &&
        (currentUserSubmission ? (
          <div className="scrap-submission-area">
            <p><strong>Movie Submitted</strong></p>
            <button onClick={onScrapMovie} className="scrap-button">
              Scrap Submission & Start Over
            </button>
          </div>
        ) : (
          <AddMovieForm onAddMovie={onAddMovie} />
        ))}

      <MovieList
        movies={movies}
        submittedVotes={submittedVotes}
        tieBreakerUser={tieBreakerUser}
        onAddRating={onAddRating}
        onRemoveRating={onRemoveRating}
        onSubmitVotes={onSubmitVotes}
        currentUser={currentUser}
        areSubmissionsComplete={finalAreSubmissionsComplete}
        areAllVotesSubmitted={areAllVotesSubmitted}
        winner={winner}
        absentUsers={absentUsers}
        activePrimaryUsers={activePrimaryUsers}
      />

      {currentUser === 'user-3' && isKcAuthenticated && finalAreSubmissionsComplete && !winner && (
        <div className="end-week-section">
          <button onClick={pickWinner} className="end-week-button" disabled={!areAllVotesSubmitted}>
            End Voting & Pick Winner
          </button>
        </div>
      )}

      {winner && (
        <div className="end-week-section">
          <label htmlFor="movie-night-date">Movie Night Date:</label>
          <input
            id="movie-night-date"
            type="date"
            value={movieNightDate}
            onChange={(e) => setMovieNightDate(e.target.value)}
          />
          <button onClick={handleEndWeek} className="end-week-button">
            Archive Week & Start New
          </button>
        </div>
      )}
    </div>
  );
}