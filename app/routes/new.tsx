import { useState } from "react";
import { Link, useNavigate } from "@remix-run/react";

export default function NewPage() {
  const [name, setName] = useState("");
  const navigate = useNavigate();

  const slug = name.replace(/[^a-z0-9\-_]/gi, "").toLowerCase();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (slug) {
      navigate(`/dash?edit=${slug}`);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold text-gray-100 mb-6">Create a New Page</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1">
              Page Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="my-page-name"
              autoFocus
              className="w-full p-3 border border-gray-600 bg-gray-700 text-gray-100 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition placeholder-gray-400"
            />
            {name && slug !== name && (
              <p className="mt-1 text-xs text-gray-400">
                Will be saved as: <span className="text-gray-200 font-mono">{slug}</span>
              </p>
            )}
            {name && !slug && (
              <p className="mt-1 text-xs text-red-400">Name must contain at least one valid character (a–z, 0–9, - or _)</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={!slug}
              className="bg-blue-600 text-white font-bold py-3 px-6 rounded-md hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 focus:ring-offset-gray-900 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Edit
            </button>
            <Link to="/dash" className="text-gray-400 hover:text-white font-medium transition-colors">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
