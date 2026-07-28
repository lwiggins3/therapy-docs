import type { ReactNode } from "react";

export const metadata = {
  title: "Therapy Docs",
  description: "Post-session aid recommendations for therapists",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
