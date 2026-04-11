import { useNavigate } from 'react-router-dom';
import { useState, KeyboardEvent } from 'react';

export default function SearchBar() {
  const [keyword, setKeyword] = useState('');
  const navigate = useNavigate();

  const handleSearch = () => {
    if (keyword.trim()) {
      navigate(`/search?q=${encodeURIComponent(keyword.trim())}`);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="flex items-center">
      <input
        type="text"
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="搜索文章..."
        className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary"
      />
      <button
        onClick={handleSearch}
        className="ml-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-600"
      >
        搜索
      </button>
    </div>
  );
}