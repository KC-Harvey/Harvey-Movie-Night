import { useState } from 'react';

interface AddMovieFormProps {
  onAddMovie: (title: string, trailerLink: string) => void;
}

export default function AddMovieForm({ onAddMovie }: AddMovieFormProps) {
  const [title, setTitle] = useState('');
  const [trailerLink, setTrailerLink] = useState('');

  const handleSubmit = () => {
    onAddMovie(title, trailerLink);
    setTitle('');
    setTrailerLink('');
  };

  return (
    <div className="add-movie-form">
      <h2>Add a Movie</h2>
      <input 
        type="text" 
        placeholder="Movie Title" 
        value={title} 
        onChange={(e) => setTitle(e.target.value)} 
        required 
      />
      <input 
        type="text" 
        placeholder="Trailer Link (Optional)" 
        value={trailerLink} 
        onChange={(e) => setTrailerLink(e.target.value)}
      />
      <button onClick={handleSubmit}>Add Movie</button>
    </div>
  );
}