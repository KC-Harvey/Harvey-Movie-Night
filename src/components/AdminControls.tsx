import { useState } from 'react';
import { USERS } from '../App';

interface AdminControlsProps {
  setSubmissionDeadline: (deadline: string) => void;
  endSubmissions: () => void;
  updateUserAbsence: (userId: string, isAbsent: boolean) => void;
  absentUsers: string[];
  resetUserVote: (userId: string) => Promise<void>;
  submittedVotes: string[];
}

export default function AdminControls({ setSubmissionDeadline, endSubmissions, updateUserAbsence, absentUsers, resetUserVote, submittedVotes }: AdminControlsProps) {
  const [deadline, setDeadline] = useState('');

  const handleSetDeadline = () => {
    if (deadline) {
      setSubmissionDeadline(deadline);
    } else {
      alert('Please select a date and time.');
    }
  };

  const handleResetVote = (userId: string) => {
    const userName = USERS[userId].name;
    if (confirm(`Reset ${userName}'s vote? They will be able to vote again.`)) {
      resetUserVote(userId);
    }
  };

  return (
    <div className="admin-controls">
      <h3>Admin Controls</h3>
      <div className="admin-section">
        <input
          type="datetime-local"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
        />
        <button onClick={handleSetDeadline}>Set Deadline</button>
        <button onClick={endSubmissions}>End Submissions Now</button>
      </div>
      <div className="admin-section">
        <h4>Manage Absences</h4>
        <div className="absence-checkboxes">
          {Object.values(USERS).map(user => (
            <label key={user.id}>
              <input 
                type="checkbox"
                checked={absentUsers.includes(user.id)}
                onChange={(e) => updateUserAbsence(user.id, e.target.checked)}
              />
              {user.name}
            </label>
          ))}
        </div>
      </div>
      <div className="admin-section">
        <h4>Reset User Votes</h4>
        <div className="vote-reset-buttons">
          {['user-1', 'user-2', 'user-3', 'user-4', 'user-5'].map(userId => {
            const user = USERS[userId];
            const hasVoted = submittedVotes.includes(userId);
            return (
              <button
                key={userId}
                onClick={() => handleResetVote(userId)}
                disabled={!hasVoted}
                className={`vote-reset-button ${hasVoted ? 'voted' : 'not-voted'}`}
              >
                Reset {user.name} {hasVoted ? '✓' : ''}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}