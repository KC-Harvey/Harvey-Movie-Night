import { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Routes, Route } from 'react-router-dom';
import type { Movie, ArchivedWeek, UserVote } from './interfaces';
import Layout from './components/Layout';
import WeeklyPage from './pages/WeeklyPage';
import HistoryPage from './pages/HistoryPage';
import { supabase } from './supabaseClient'; // Make sure you have this file
import './App.css';

export interface User {
  id: string;
  name: string;
}

// This remains a client-side constant
export const USERS: { [key: string]: User } = {
  'user-1': { id: 'user-1', name: 'Dad' },
  'user-2': { id: 'user-2', name: 'Mom' },
  'user-3': { id: 'user-3', name: 'KC' },
  'user-4': { id: 'user-4', name: 'Ashleigh' },
  'user-5': { id: 'user-5', name: 'Zach' },
  'user-6': { id: 'user-6', name: 'Kayla' },
};

const getNextSaturday = () => {
    const now = new Date();
    const nextSaturday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (6 - now.getDay() + 7) % 7, 24, 0, 0, 0);
    return nextSaturday.toISOString();
};


function App() {
  const [currentUser, setCurrentUser] = useState<string>('user-1');
  // The main state is now primarily for UI and non-persistent data
  const [appState, setAppState] = useState<{
    currentMovies: Movie[];
    // history is removed from here, as HistoryPage will fetch its own
    submittedVotes: string[];
    tieBreakerUser: string | null;
    submissionDeadline: string | null;
    areSubmissionsComplete: boolean;
    isKcAuthenticated: boolean;
    winner: Movie | null;
    absentUsers: string[];
  }>({
    currentMovies: [],
    submittedVotes: [],
    tieBreakerUser: null,
    submissionDeadline: getNextSaturday(),
    areSubmissionsComplete: false,
    isKcAuthenticated: false, // Always reset on page load for security
    winner: null,
    absentUsers: [],
  });

  // Fetch initial data from Supabase on component mount
  useEffect(() => {
    const fetchCurrentMovies = async () => {
      // We assume movies not in an archived week are the "current" ones.
      // This logic might need refinement based on your schema. A simple way is to
      // add an `archived_week_id` to your movies table which is NULL for current movies.
      // For now, we'll fetch all and assume they are current until archived.
      const { data: movies, error } = await supabase
        .from('movies')
        .select('*, ratings(*)') // Fetch movies and their related ratings
        .is('archived_week_id', null); // Only get movies that are not yet archived

      if (error) {
        console.error('Error fetching current movies:', error);
      } else {
        // Process the fetched data to match the existing `Movie` interface
        const processedMovies = movies.map(movie => {
            const ratings: UserVote = {};
            let totalRating = 0;
            movie.ratings.forEach((r: any) => {
                ratings[r.user_id] = r.rating;
                totalRating += r.rating;
            });
            return {
                ...movie,
                trailerLink: movie.trailer_link,
                submittedBy: movie.submitted_by,
                ratings,
                averageRating: movie.ratings.length > 0 ? totalRating / movie.ratings.length : 0,
            }
        });
        setAppState(prevState => ({ ...prevState, currentMovies: processedMovies }));
      }
    };

    fetchCurrentMovies();
  }, []);


  const updateUserAbsence = (userId: string, isAbsent: boolean) => {
    setAppState(prevState => {
      const updatedAbsentUsers = isAbsent
        ? [...prevState.absentUsers, userId]
        : prevState.absentUsers.filter(id => id !== userId);
      // This state can remain client-side as it's not critical to persist across sessions
      return { ...prevState, absentUsers: updatedAbsentUsers };
    });
  };

  const authenticateKc = (pin: string): boolean => {
    if (pin === '7879') { // You should move this to an environment variable
      setAppState(prevState => ({ ...prevState, isKcAuthenticated: true }));
      return true;
    }
    return false;
  };

  const setSubmissionDeadline = (deadline: string) => {
    setAppState(prevState => ({ ...prevState, submissionDeadline: deadline }));
  };

  const endSubmissions = () => {
    setAppState(prevState => ({ ...prevState, areSubmissionsComplete: true }));
  };

  const addMovie = async (title: string, trailerLink: string) => {
    if (!title) {
        alert("Movie Title is required.");
        return;
    }
    const newMovieData = {
        id: uuidv4(),
        title,
        trailer_link: trailerLink,
        submitted_by: currentUser,
        average_rating: 0, // Will be calculated based on ratings
    };

    const { data: newMovie, error } = await supabase
        .from('movies')
        .insert(newMovieData)
        .select()
        .single();

    if (error) {
        console.error('Error adding movie:', error);
        alert('Failed to add movie.');
    } else {
        setAppState(prevState => ({
            ...prevState,
            currentMovies: [...prevState.currentMovies, { ...newMovie, ratings: {}, averageRating: 0, submittedBy: newMovie.submitted_by, trailerLink: newMovie.trailer_link }],
        }));
    }
  };

  const scrapMovie = async () => {
    const movieToScrap = appState.currentMovies.find(movie => movie.submittedBy === currentUser);
    if (!movieToScrap) return;

    const { error } = await supabase.from('movies').delete().match({ id: movieToScrap.id });

    if (error) {
        console.error('Error scrapping movie:', error);
        alert('Failed to scrap movie.');
    } else {
        const updatedMovies = appState.currentMovies.filter(movie => movie.id !== movieToScrap.id);
        setAppState(prevState => ({ ...prevState, currentMovies: updatedMovies }));
    }
  };

  const addRating = async (movieId: string, rating: number) => {
    // Upsert the rating in the database
    const { error } = await supabase.from('ratings').upsert({
        movie_id: movieId,
        user_id: currentUser,
        rating: rating,
    }, { onConflict: 'movie_id, user_id' });

    if (error) {
        console.error('Error adding rating:', error);
        return;
    }

    // Refetch the single movie to update its average rating
    await refetchMovie(movieId);
  };
  
  const removeRating = async (movieId: string) => {
      const { error } = await supabase.from('ratings').delete().match({
          movie_id: movieId,
          user_id: currentUser
      });

      if (error) {
          console.error('Error removing rating:', error);
          return;
      }
      await refetchMovie(movieId);
  };

  // Helper function to refetch a movie and update its state
  const refetchMovie = async (movieId: string) => {
      const { data: movie, error } = await supabase
        .from('movies')
        .select('*, ratings(*)')
        .eq('id', movieId)
        .single();
      
      if (error) {
          console.error('Error refetching movie:', error);
      } else {
          const ratings: UserVote = {};
          let totalRating = 0;
          movie.ratings.forEach((r: any) => {
              ratings[r.user_id] = r.rating;
              totalRating += r.rating;
          });
          const averageRating = movie.ratings.length > 0 ? totalRating / movie.ratings.length : 0;
          
          // Also update the average rating in the database
          await supabase.from('movies').update({ average_rating: averageRating }).eq('id', movieId);

          const updatedMovie = {
              ...movie,
              trailerLink: movie.trailer_link,
              submittedBy: movie.submitted_by,
              ratings,
              averageRating,
          };

          setAppState(prevState => ({
              ...prevState,
              currentMovies: prevState.currentMovies.map(m => m.id === movieId ? updatedMovie : m)
          }));
      }
  };


  const submitVotes = () => {
    if (!appState.submittedVotes.includes(currentUser)) {
      setAppState(prevState => ({ ...prevState, submittedVotes: [...prevState.submittedVotes, currentUser] }));
    }
  };

  const pickWinner = () => {
    // This logic can remain mostly client-side as it's about determining the winner from the current state
    if (appState.currentMovies.length === 0) return;
    
    let winner: Movie | undefined;
    let tieBreakerName: string | null = null;
    const sortedMovies = [...appState.currentMovies].sort((a, b) => b.averageRating - a.averageRating);
    const topScore = sortedMovies[0]?.averageRating;
    const potentialWinners = sortedMovies.filter(m => m.averageRating === topScore);

    if (potentialWinners.length > 1 && typeof topScore === 'number' && topScore > 0) {
      const primaryVoters = ['user-1', 'user-2', 'user-3', 'user-4', 'user-5'].filter(id => !appState.absentUsers.includes(id));
      if (primaryVoters.length > 0) {
        const tieBreakerId = primaryVoters[Math.floor(Math.random() * primaryVoters.length)];
        tieBreakerName = USERS[tieBreakerId].name;
        const sortedByTieBreaker = potentialWinners.sort((a, b) => {
          const voteA = a.ratings[tieBreakerId] || 0;
          const voteB = b.ratings[tieBreakerId] || 0;
          return voteB - voteA;
        });
        winner = sortedByTieBreaker[0];
      } else {
        winner = potentialWinners[Math.floor(Math.random() * potentialWinners.length)];
      }
    } else {
      winner = sortedMovies[0];
    }

    setAppState(prevState => ({
      ...prevState,
      winner: winner || null,
      tieBreakerUser: tieBreakerName,
    }));
  };

  const endWeekAndArchive = async (date: string) => {
    if (!appState.winner) {
        alert("A winner must be picked before archiving the week.");
        return;
    }
    
    // 1. Create the new archived week entry
    const { data: newArchive, error: archiveError } = await supabase
        .from('archived_weeks')
        .insert({
            id: uuidv4(),
            date: date,
            winner_id: appState.winner.id,
        })
        .select()
        .single();

    if (archiveError) {
        console.error('Error creating archive:', archiveError);
        alert('Failed to archive week.');
        return;
    }

    // 2. Update all current movies to link them to the new archive
    const movieIds = appState.currentMovies.map(m => m.id);
    const { error: updateError } = await supabase
        .from('movies')
        .update({ archived_week_id: newArchive.id })
        .in('id', movieIds);

    if (updateError) {
        console.error('Error updating movies for archive:', updateError);
        // You might want to handle this more gracefully, e.g., by deleting the archive entry
        alert('Failed to update movies for archiving.');
        return;
    }

    // 3. Reset the client-side state for the new week
    setAppState(prevState => ({
        ...prevState,
        currentMovies: [],
        submittedVotes: [],
        tieBreakerUser: null,
        submissionDeadline: getNextSaturday(),
        areSubmissionsComplete: false,
        winner: null,
        absentUsers: [],
    }));
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Harvey Movie Night</h1>
      </header>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route
            index
            element={
              <WeeklyPage
                movies={appState.currentMovies}
                submittedVotes={appState.submittedVotes}
                tieBreakerUser={appState.tieBreakerUser}
                onAddMovie={addMovie}
                onScrapMovie={scrapMovie}
                onAddRating={addRating}
                onRemoveRating={removeRating}
                onSubmitVotes={submitVotes}
                onEndWeek={endWeekAndArchive}
                currentUser={currentUser}
                setCurrentUser={setCurrentUser}
                submissionDeadline={appState.submissionDeadline}
                setSubmissionDeadline={setSubmissionDeadline}
                areSubmissionsComplete={appState.areSubmissionsComplete}
                endSubmissions={endSubmissions}
                isKcAuthenticated={appState.isKcAuthenticated}
                authenticateKc={authenticateKc}
                winner={appState.winner}
                pickWinner={pickWinner}
                updateUserAbsence={updateUserAbsence}
                absentUsers={appState.absentUsers}
              />
            }
          />
          {/* HistoryPage no longer needs history passed as a prop */}
          <Route path="history" element={<HistoryPage />} />
        </Route>
      </Routes>
    </div>
  );
}

export default App;
