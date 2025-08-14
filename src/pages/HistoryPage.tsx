import { useState, useEffect } from 'react';
import type { ArchivedWeek } from '../interfaces';
import { USERS } from '../App'; // USERS can still be useful for names
import { supabase } from '../supabaseClient'; // Import the Supabase client

// Helper function to format a date string into a "YYYY-MM" key
const getMonthYearKey = (dateString: string) => {
    const date = new Date(dateString);
    const year = date.getUTCFullYear();
    const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    return `${year}-${month}`;
};

// Helper to display a "Month Year" string for the UI from a key
const formatMonthYear = (monthKey: string) => {
    const [year, month] = monthKey.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleString('default', { month: 'long', year: 'numeric' });
}

export default function HistoryPage() {
  // The component now manages its own history state
  const [history, setHistory] = useState<ArchivedWeek[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedMonths, setExpandedMonths] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    const fetchHistory = async () => {
      setIsLoading(true);
      // Fetch archived weeks and all related movies for each week
      const { data, error } = await supabase
        .from('archived_weeks')
        .select(`
          id,
          date,
          winner_id,
          movies (
            id,
            title,
            submitted_by,
            average_rating
          )
        `)
        .order('date', { ascending: false }); // Order by date descending

      if (error) {
        console.error('Error fetching history:', error);
        // Handle the error in the UI if needed
      } else {
        // Process the data to match the ArchivedWeek interface
        const processedHistory = data.map((week: any) => ({
            ...week,
            winnerId: week.winner_id,
            movies: week.movies.map((movie: any) => ({
                ...movie,
                submittedBy: movie.submitted_by,
                averageRating: movie.average_rating,
                // Add dummy values for fields not fetched if needed by other components
                trailerLink: '',
                ratings: {},
            }))
        }));
        setHistory(processedHistory);
      }
      setIsLoading(false);
    };

    fetchHistory();
  }, []); // Empty dependency array means this runs once on mount

  if (isLoading) {
    return <h2>Loading History...</h2>;
  }

  if (history.length === 0) {
    return <h2>No history yet. Complete a week to see it here!</h2>;
  }

  // Group weeks by month and year
  const groupedHistory = history.reduce((acc, week) => {
    const monthKey = getMonthYearKey(week.date);
    if (!acc[monthKey]) {
      acc[monthKey] = [];
    }
    acc[monthKey].push(week);
    return acc;
  }, {} as { [key: string]: ArchivedWeek[] });

  const sortedMonthKeys = Object.keys(groupedHistory); // Already sorted by fetch query

  const toggleMonth = (monthKey: string) => {
    setExpandedMonths(prev => ({
      ...prev,
      [monthKey]: !prev[monthKey]
    }));
  };

  return (
    <div className="history-page">
      <h2>Movie Night History</h2>
      {sortedMonthKeys.map(monthKey => (
        <div key={monthKey} className="month-group">
          <button className="month-header" onClick={() => toggleMonth(monthKey)}>
            {formatMonthYear(monthKey)}
            <span className={`chevron ${expandedMonths[monthKey] ? 'expanded' : ''}`}>▼</span>
          </button>
          
          {expandedMonths[monthKey] && (
            <div className="weeks-container">
              {groupedHistory[monthKey].map(week => (
                <div key={week.id} className="archived-week-item">
                  <h3>
                    Week of {new Date(week.date).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </h3>
                  <ul>
                    {week.movies.sort((a,b) => b.averageRating - a.averageRating).map(movie => (
                      <li key={movie.id} className={movie.id === week.winnerId ? 'winner' : ''}>
                        {movie.title} ({movie.averageRating.toFixed(1)})
                        <span className="submitted-by-history"> - Submitted by {USERS[movie.submittedBy]?.name || 'Unknown'}</span>
                        {movie.id === week.winnerId && ' 🏆 WINNER'}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
