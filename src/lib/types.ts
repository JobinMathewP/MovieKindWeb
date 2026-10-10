export type Profile = {
  id: string;
  displayName: string;
  languages: string[];
  createdAt: string;
};

export type FilmCard = {
  tmdbId: number;
  title: string;
  year: number | null;
  posterPath: string | null;
  genres: string[];
};

export type Review = {
  id: string;
  tmdbId: number;
  rating: number | null;
  body: string | null;
  createdAt: string;
  updatedAt: string;
  film: FilmCard;
};

export type SearchHit = {
  tmdbId: number;
  title: string;
  originalTitle: string | null;
  year: number | null;
  posterPath: string | null;
  originalLanguage: string | null;
  genreNames: string[];
};

export type Film = {
  tmdbId: number;
  title: string;
  originalTitle: string | null;
  year: number | null;
  posterPath: string | null;
  originalLanguage: string | null;
  genres: string[];
  runtimeMinutes: number | null;
  overview: string | null;
  fetchedAt: string;
};

export type Recommendation = {
  tmdbId: number;
  title: string;
  year: number | null;
  posterPath: string | null;
  genres: string[];
  originalLanguage: string | null;
  likedByCount: number;
  averageRating: number;
  matchNames: string[];
  matchCount: number;
};

export type LikedFilm = {
  tmdbId: number;
  title: string;
  year: number | null;
  posterPath: string | null;
  genres: string[];
  rating: number;
};
