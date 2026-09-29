export interface SearchDoc {
  id: string;
  title: string;
  tokens: string[];
}

export interface SearchHit {
  id: string;
  score: number;
}
