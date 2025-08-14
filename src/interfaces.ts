// A specific type for a user's vote
export type UserVote = {
  [userId: string]: number; // e.g., { 'user-1': 5, 'user-2': 3 }
};

export interface Movie {
  id: string;
  title: string;
  trailerLink: string;
  submittedBy: string; // This will now be a User ID
  // Ratings are no longer a simple array
  ratings: UserVote;
  averageRating: number;
}

export interface ArchivedWeek {
  id: string;
  date: string;
  movies: Movie[];
  winnerId: string | null;
}

export interface User {
  id: string;
  name: string;
  isAbsent: boolean;
}