import { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Routes, Route } from 'react-router-dom';
import type { Movie, UserVote } from './interfaces';
import Layout from './components/Layout';
import WeeklyPage from './pages/WeeklyPage';
import HistoryPage from './pages/HistoryPage';
import { supabase } from './supabaseClient';
import './App.css';

export interface User {
  id: string;
  name: string;
}

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
  const [currentUser, setCurrentUser] = useState<string>('');
  const [appState, setAppState] = useState<{
    currentMovies: Movie[];
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
    isKcAuthenticated: false,
    winner: null,
    absentUsers: [],
  });

  useEffect(() => {
    const fetchInitialData = async () => {
      // Fetch current movies
      const { data: movies, error: moviesError } = await supabase
        .from('movies')
        .select('*, ratings(*)')
        .is('archived_week_id', null);

      let processedMovies: Movie[] = [];
      if (moviesError) {
        console.error('Error fetching current movies:', moviesError);
      } else {
        processedMovies = movies.map((movie: any) => {
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

      // Fetch the entire weekly state
      const { data: weeklyState, error: stateError } = await supabase
        .from('weekly_state')
        .select('*')
        .eq('id', 1)
        .single();

      if (stateError) {
        console.error('Error fetching weekly state:', stateError);
      } else if (weeklyState) {
        let winnerMovie = null;
        if (weeklyState.winner_id) {
            // Find the winner from the movies we already fetched
            winnerMovie = processedMovies.find(m => m.id === weeklyState.winner_id) || null;
        }

        setAppState(prevState => ({
            ...prevState,
            absentUsers: weeklyState.absent_users || [],
            submissionDeadline: weeklyState.submission_deadline,
            areSubmissionsComplete: weeklyState.are_submissions_complete,
            submittedVotes: weeklyState.submitted_votes || [],
            tieBreakerUser: weeklyState.tie_breaker_user,
            winner: winnerMovie
        }));
      }
    };

    fetchInitialData();

    // --- REAL-TIME SUBSCRIPTION ---
    const channel = supabase
      .channel('weekly_state_changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'weekly_state' },
        (payload) => {
          console.log('Change received!', payload);
          const newState = payload.new;
          
          let winnerMovie = null;
          if (newState.winner_id) {
              winnerMovie = appState.currentMovies.find(m => m.id === newState.winner_id) || null;
          }

          setAppState(prevState => ({
            ...prevState,
            absentUsers: newState.absent_users || [],
            submissionDeadline: newState.submission_deadline,
            areSubmissionsComplete: newState.are_submissions_complete,
            submittedVotes: newState.submitted_votes || [],
            tieBreakerUser: newState.tie_breaker_user,
            winner: winnerMovie
          }));
        }
      )
      .subscribe();

    // Cleanup subscription on component unmount
    return () => {
      supabase.removeChannel(channel);
    };

  }, [appState.currentMovies]);


  const updateWeeklyState = async (newState: object) => {
    const { error } = await supabase
      .from('weekly_state')
      .update(newState)
      .eq('id', 1);
    if (error) {
      console.error('Error updating weekly state:', error);
      alert('There was an error saving the state.');
    }
  };

  const updateUserAbsence = async (userId: string, isAbsent: boolean) => {
    const updatedAbsentUsers = isAbsent
      ? [...appState.absentUsers, userId]
      : appState.absentUsers.filter(id => id !== userId);
    await updateWeeklyState({ absent_users: updatedAbsentUsers });
  };

  const authenticateKc = (pin: string): boolean => {
    if (pin === '7879') {
      setAppState(prevState => ({ ...prevState, isKcAuthenticated: true }));
      return true;
    }
    return false;
  };


  const setSubmissionDeadline = async (deadline: string) => {
    await updateWeeklyState({ submission_deadline: deadline });
  };

  const endSubmissions = async () => {
    await updateWeeklyState({ are_submissions_complete: true });
  };
  
  const submitVotes = async () => {
    if (!appState.submittedVotes.includes(currentUser)) {
      const newSubmittedVotes = [...appState.submittedVotes, currentUser];
      await updateWeeklyState({ submitted_votes: newSubmittedVotes });
    }
  };

  const pickWinner = async () => {
    if (appState.currentMovies.length === 0) return;
    
    let winner: Movie | undefined;
    let tieBreakerName: string | null = null;
    const sortedMovies = [...appState.currentMovies].sort((a, b) => b.averageRating - a.averageRating);
    const topScore = sortedMovies[0]?.averageRating;
    
    // Use a small epsilon for floating point comparison to handle precision issues
    const epsilon = 0.000001;
    const potentialWinners = sortedMovies.filter(m => Math.abs(m.averageRating - topScore) < epsilon);

    console.log(`Top score: ${topScore}, Potential winners: ${potentialWinners.length}`, potentialWinners.map(m => ({ title: m.title, score: m.averageRating })));

    if (potentialWinners.length > 1 && typeof topScore === 'number') {
      const primaryVoters = ['user-1', 'user-2', 'user-3', 'user-4', 'user-5'].filter(id => !appState.absentUsers.includes(id));
      if (primaryVoters.length > 0) {
        const tieBreakerId = primaryVoters[Math.floor(Math.random() * primaryVoters.length)];
        tieBreakerName = USERS[tieBreakerId].name;
        console.log(`Tie detected! Using ${tieBreakerName} as tiebreaker`);
        
        const sortedByTieBreaker = potentialWinners.sort((a, b) => {
          const voteA = a.ratings[tieBreakerId] || 0;
          const voteB = b.ratings[tieBreakerId] || 0;
          console.log(`${a.title}: ${voteA}, ${b.title}: ${voteB}`);
          return voteB - voteA;
        });
        winner = sortedByTieBreaker[0];
        console.log(`Winner after tiebreaker: ${winner.title}`);
      } else {
        winner = potentialWinners[Math.floor(Math.random() * potentialWinners.length)];
        tieBreakerName = "Random Selection";
        console.log(`No primary voters available, random winner: ${winner.title}`);
      }
    } else {
      winner = sortedMovies[0];
      console.log(`Clear winner: ${winner?.title}`);
    }

    if (winner) {
        await updateWeeklyState({ winner_id: winner.id, tie_breaker_user: tieBreakerName });
    }
  };

  const resetWeek = async () => {
    if (!confirm("Are you sure you want to reset the current week? This will delete all movies and votes for this week and cannot be undone.")) {
      return;
    }

    // Delete all current movies and their ratings
    const movieIds = appState.currentMovies.map(m => m.id);
    if (movieIds.length > 0) {
      await supabase.from('ratings').delete().in('movie_id', movieIds);
      await supabase.from('movies').delete().in('id', movieIds);
    }

    // Reset the weekly state for a fresh week
    await updateWeeklyState({
      absent_users: [],
      submission_deadline: getNextSaturday(),
      are_submissions_complete: false,
      submitted_votes: [],
      tie_breaker_user: null,
      winner_id: null
    });

    // Reset client-side state
    setAppState(prevState => ({
      ...prevState,
      currentMovies: [],
      submittedVotes: [],
      tieBreakerUser: null,
      winner: null,
      absentUsers: [],
      areSubmissionsComplete: false,
    }));

    alert("Week has been reset successfully!");
  };

  const endWeekAndArchive = async (date: string) => {
    if (!appState.winner) {
        alert("A winner must be picked before archiving the week.");
        return;
    }
    
    const { data: newArchive, error: archiveError } = await supabase
        .from('archived_weeks')
        .insert({ id: uuidv4(), date: date, winner_id: appState.winner.id })
        .select().single();

    if (archiveError) {
        console.error('Error creating archive:', archiveError);
        return;
    }

    const movieIds = appState.currentMovies.map(m => m.id);
    await supabase.from('movies').update({ archived_week_id: newArchive.id }).in('id', movieIds);

    // Reset the weekly state for the new week
    await updateWeeklyState({
        absent_users: [],
        submission_deadline: getNextSaturday(),
        are_submissions_complete: false,
        submitted_votes: [],
        tie_breaker_user: null,
        winner_id: null
    });

    // Reset client-side state
    setAppState(prevState => ({
        ...prevState,
        currentMovies: [],
    }));
  };

  const addMovie = async (title: string, trailerLink: string) => {
    if (!title) {
        alert("Movie Title is required.");
        return;
    }
    const newMovieData = { id: uuidv4(), title, trailer_link: trailerLink, submitted_by: currentUser, average_rating: 0 };
    const { data: newMovie, error } = await supabase.from('movies').insert(newMovieData).select().single();
    if (error) console.error('Error adding movie:', error);
    else {
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
    if (error) console.error('Error scrapping movie:', error);
    else {
        const updatedMovies = appState.currentMovies.filter(movie => movie.id !== movieToScrap.id);
        setAppState(prevState => ({ ...prevState, currentMovies: updatedMovies }));
    }
  };

  const addRating = async (movieId: string, rating: number) => {
    const { error } = await supabase.from('ratings').upsert({ movie_id: movieId, user_id: currentUser, rating: rating }, { onConflict: 'movie_id, user_id' });
    if (error) console.error('Error adding rating:', error);
    else await refetchMovie(movieId);
  };
  
  const removeRating = async (movieId: string) => {
      const { error } = await supabase.from('ratings').delete().match({ movie_id: movieId, user_id: currentUser });
      if (error) console.error('Error removing rating:', error);
      else await refetchMovie(movieId);
  };

  const refetchMovie = async (movieId: string) => {
      const { data: movie, error } = await supabase.from('movies').select('*, ratings(*)').eq('id', movieId).single();
      if (error) console.error('Error refetching movie:', error);
      else {
          const ratings: UserVote = {};
          let totalRating = 0;
          movie.ratings.forEach((r: any) => {
              ratings[r.user_id] = r.rating;
              totalRating += r.rating;
          });
          const averageRating = movie.ratings.length > 0 ? totalRating / movie.ratings.length : 0;
          await supabase.from('movies').update({ average_rating: averageRating }).eq('id', movieId);
          const updatedMovie = { ...movie, trailerLink: movie.trailer_link, submittedBy: movie.submitted_by, ratings, averageRating };
          setAppState(prevState => ({
              ...prevState,
              currentMovies: prevState.currentMovies.map(m => m.id === movieId ? updatedMovie : m)
          }));
      }
  };

  // Add the resetUserVote function
  const resetUserVote = async (userId: string) => {
    // Remove the specified user from submittedVotes array so they can vote again
    const updatedSubmittedVotes = appState.submittedVotes.filter(id => id !== userId);
    await updateWeeklyState({ submitted_votes: updatedSubmittedVotes });
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
                resetUserVote={resetUserVote}
                resetWeek={resetWeek}
              />
            }
          />
          <Route path="history" element={<HistoryPage />} />
        </Route>
      </Routes>
    </div>
  );
}

export default App;
