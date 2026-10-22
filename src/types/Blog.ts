export interface Blog {
  id: string;
  slug: string;
  body: string;
  data: {
    title: string;
    description: string;
    pubDate: string;
    updated?: Date;
    image?: string;
  };
}
