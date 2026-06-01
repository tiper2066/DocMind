export type ExtractResult = {
  text: string;
  title?: string;
  meta?: Record<string, unknown>;
};

export type CrawlerError = {
  kind: "fetch" | "parse" | "unsupported" | "empty";
  message: string;
};
