import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";

export default function SearchBar({ initial = "" }: { initial?: string }) {
  const [q, setQ] = useState(initial);
  const navigate = useNavigate();

  function submit(e: FormEvent) {
    e.preventDefault();
    const query = q.trim();
    if (query.length >= 2) navigate(`/search?q=${encodeURIComponent(query)}`);
  }

  return (
    <form className="searchbar" onSubmit={submit} role="search">
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Describe a sighting — e.g. strange lights over New Mexico in the 1950s"
        aria-label="Search declassified case files"
      />
      <button className="btn btn--primary" type="submit" disabled={q.trim().length < 2}>
        Search
      </button>
    </form>
  );
}
