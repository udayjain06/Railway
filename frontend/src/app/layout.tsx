// @ts-ignore: allow side-effect CSS import without explicit type declarations
import "./globals.css";

export const metadata = {
  title: "RailSaarthi — Railway Safety Dashboard",
  description: "AI-powered railway operations and safety monitoring. FAR AWAY 2026.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
