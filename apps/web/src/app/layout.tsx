import type { ReactNode } from "react";
import { Nav } from "../components/Nav";
import "./globals.css";

export const metadata = {
  title: "Therapy Docs",
  description: "Post-session aid recommendations for therapists",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Nav />
        <main className="mx-auto max-w-4xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
